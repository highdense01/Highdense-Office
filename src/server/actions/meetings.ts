"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requirePermission, requireAuth, hasPermission, type SessionUser } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAccessProject } from "@/lib/permissions/project-access";
import { createNotifications } from "@/lib/notifications/create";
import { generateMeetingLinkFromCode } from "@/lib/meetings/jitsi";
import { generateMeetingCode, normalizeMeetingCode } from "@/lib/meetings/code";
import {
  createMeetingSchema,
  updateMeetingSchema,
  type CreateMeetingInput,
  type UpdateMeetingInput,
} from "@/lib/validations/meeting";
import type { ActionResult } from "./employees";

export async function createMeeting(input: CreateMeetingInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.MEETING_CREATE);

  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  if (data.projectId && !(await canAccessProject(actor, data.projectId))) {
    return { success: false, error: "Project not found." };
  }

  const code = await uniqueMeetingCode();
  const meeting = await prisma.meeting.create({
    data: {
      title: data.title,
      description: data.description || null,
      projectId: data.projectId || null,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      code,
      meetingLink: generateMeetingLinkFromCode(code),
      createdById: actor.id,
      participants: {
        create: [...new Set([actor.id, ...data.participantIds])].map((userId) => ({ userId })),
      },
    },
    select: { id: true, title: true },
  });

  await createNotifications(
    data.participantIds
      .filter((id) => id !== actor.id)
      .map((userId) => ({
        userId,
        type: "MEETING_SCHEDULED" as const,
        title: "New meeting scheduled",
        message: `${actor.name ?? actor.email} scheduled "${data.title}"`,
        entityType: "Meeting",
        entityId: meeting.id,
      })),
  );

  await logActivity({
    userId: actor.id,
    action: "meeting.created",
    entityType: "Meeting",
    entityId: meeting.id,
    description: `${actor.name ?? actor.email} scheduled meeting "${data.title}"`,
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  return { success: true, data: { id: meeting.id } };
}

export async function updateMeeting(input: UpdateMeetingInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.MEETING_UPDATE);

  const parsed = updateMeetingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, participantIds, ...data } = parsed.data;

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Meeting not found." };

  await prisma.meeting.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.status !== undefined && { status: data.status }),
      ...(participantIds !== undefined && {
        participants: { deleteMany: {}, create: participantIds.map((userId) => ({ userId })) },
      }),
    },
  });

  await logActivity({
    userId: actor.id,
    action: "meeting.updated",
    entityType: "Meeting",
    entityId: id,
    description: `${actor.name ?? actor.email} updated meeting "${existing.title}"`,
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  return { success: true, data: undefined };
}

export async function cancelMeeting(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.MEETING_DELETE);

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Meeting not found." };

  await prisma.meeting.update({ where: { id }, data: { status: "CANCELLED" } });

  await logActivity({
    userId: actor.id,
    action: "meeting.cancelled",
    entityType: "Meeting",
    entityId: id,
    description: `${actor.name ?? actor.email} cancelled meeting "${existing.title}"`,
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  return { success: true, data: undefined };
}

export async function respondToMeeting(
  meetingId: string,
  status: "ACCEPTED" | "DECLINED",
): Promise<ActionResult> {
  const actor = await requireAuth();

  await prisma.meetingParticipant.update({
    where: { meetingId_userId: { meetingId, userId: actor.id } },
    data: { status },
  });

  revalidatePath("/meetings");
  return { success: true, data: undefined };
}

export async function listMyMeetings() {
  const actor = await requireAuth();
  return prisma.meeting.findMany({
    where: {
      status: { not: "CANCELLED" },
      participants: { some: { userId: actor.id } },
    },
    include: { createdBy: true, project: { select: { id: true, name: true } }, participants: { include: { user: true } } },
    orderBy: { date: "asc" },
  });
}

export async function listAllMeetings() {
  await requirePermission(PERMISSIONS.MEETING_VIEW);
  return prisma.meeting.findMany({
    include: { createdBy: true, project: { select: { id: true, name: true } }, participants: { include: { user: true } } },
    orderBy: { date: "desc" },
  });
}

// ---------------------------------------------------------------------------
// In-app video / audio rooms
// ---------------------------------------------------------------------------

async function uniqueMeetingCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMeetingCode();
    if (!(await prisma.meeting.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate a unique meeting code.");
}

type RoomMeeting = { createdById: string; participants: { userId: string }[] };

/** Invited, hosting, or a manager of meetings. Anyone else needs the join code (see joinMeetingByCode). */
function canEnterRoom(actor: SessionUser, meeting: RoomMeeting) {
  return (
    meeting.createdById === actor.id ||
    meeting.participants.some((p) => p.userId === actor.id) ||
    hasPermission(actor, PERMISSIONS.MEETING_UPDATE)
  );
}

/** Starts a meeting right now (like "New meeting" in Meet/Zoom). The host then shares the code or link. */
export async function createInstantMeeting(title?: string): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.MEETING_CREATE);

  const now = new Date();
  const code = await uniqueMeetingCode();
  const name = title?.trim().slice(0, 200) || `${actor.name ?? "Instant"}'s meeting`;

  const meeting = await prisma.meeting.create({
    data: {
      title: name,
      createdById: actor.id,
      date: now,
      startTime: now,
      endTime: new Date(now.getTime() + 60 * 60 * 1000),
      code,
      meetingLink: generateMeetingLinkFromCode(code),
      status: "LIVE",
      participants: { create: [{ userId: actor.id, status: "ACCEPTED" }] },
    },
    select: { id: true },
  });

  await logActivity({
    userId: actor.id,
    action: "meeting.instant_started",
    entityType: "Meeting",
    entityId: meeting.id,
    description: `${actor.name ?? actor.email} started instant meeting "${name}"`,
  });

  revalidatePath("/meetings");
  return { success: true, data: { id: meeting.id } };
}

/** Join with a code (typed or from an invite link). The code acts as the invitation. */
export async function joinMeetingByCode(rawCode: string): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.MEETING_VIEW);

  const code = normalizeMeetingCode(rawCode);
  if (!code) return { success: false, error: "Enter a valid meeting code, like abc-defg-hij." };

  const meeting = await prisma.meeting.findUnique({ where: { code }, select: { id: true, status: true } });
  if (!meeting) return { success: false, error: "No meeting found with that code." };
  if (meeting.status === "CANCELLED") return { success: false, error: "This meeting was cancelled." };
  if (meeting.status === "COMPLETED") return { success: false, error: "This meeting has already ended." };

  await prisma.meetingParticipant.upsert({
    where: { meetingId_userId: { meetingId: meeting.id, userId: actor.id } },
    update: {},
    create: { meetingId: meeting.id, userId: actor.id, status: "ACCEPTED" },
  });

  revalidatePath("/meetings");
  return { success: true, data: { id: meeting.id } };
}

/** Loads everything the room page needs and enforces who may enter. Returns null when not allowed / not found. */
export async function getMeetingRoom(id: string) {
  const actor = await requireAuth();

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { createdBy: true, participants: { include: { user: true } } },
  });
  if (!meeting || !canEnterRoom(actor, meeting)) return null;

  // Meetings created before join codes existed get one the first time their room is opened.
  let code = meeting.code;
  if (!code) {
    code = await uniqueMeetingCode();
    await prisma.meeting.update({ where: { id }, data: { code } });
  }

  return {
    meeting: { ...meeting, code },
    user: { id: actor.id, name: actor.name ?? actor.email ?? "Guest", email: actor.email ?? undefined },
    isHost: meeting.createdById === actor.id || hasPermission(actor, PERMISSIONS.MEETING_UPDATE),
  };
}

/** Called when someone actually joins: flips a SCHEDULED meeting to LIVE and records they attended. */
export async function enterMeeting(id: string): Promise<ActionResult> {
  const actor = await requireAuth();

  const meeting = await prisma.meeting.findUnique({ where: { id }, include: { participants: true } });
  if (!meeting || !canEnterRoom(actor, meeting)) return { success: false, error: "Meeting not found." };
  if (meeting.status === "CANCELLED") return { success: false, error: "This meeting was cancelled." };
  if (meeting.status === "COMPLETED") return { success: false, error: "This meeting has already ended." };

  if (meeting.status === "SCHEDULED") {
    await prisma.meeting.update({ where: { id }, data: { status: "LIVE" } });
  }
  if (!meeting.participants.some((p) => p.userId === actor.id)) {
    await prisma.meetingParticipant.create({ data: { meetingId: id, userId: actor.id, status: "ACCEPTED" } });
  }

  revalidatePath("/meetings");
  return { success: true, data: undefined };
}

export async function endMeeting(id: string): Promise<ActionResult> {
  const actor = await requireAuth();

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return { success: false, error: "Meeting not found." };
  if (meeting.createdById !== actor.id && !hasPermission(actor, PERMISSIONS.MEETING_UPDATE)) {
    return { success: false, error: "Only the host can end this meeting." };
  }
  if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") return { success: true, data: undefined };

  await prisma.meeting.update({ where: { id }, data: { status: "COMPLETED", endTime: new Date() } });

  await logActivity({
    userId: actor.id,
    action: "meeting.ended",
    entityType: "Meeting",
    entityId: id,
    description: `${actor.name ?? actor.email} ended meeting "${meeting.title}"`,
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  return { success: true, data: undefined };
}
