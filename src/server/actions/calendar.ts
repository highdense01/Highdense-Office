"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";

export type CalendarEventType = "meeting" | "task_deadline" | "project_milestone";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: Date;
  href: string;
}

export async function getCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]> {
  const actor = await requireAuth();
  const canSeeAll = hasPermission(actor, PERMISSIONS.USER_VIEW);

  const [meetings, tasks, projects] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        status: { not: "CANCELLED" },
        date: { gte: rangeStart, lte: rangeEnd },
        participants: { some: { userId: actor.id } },
      },
      select: { id: true, title: true, date: true },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: rangeStart, lte: rangeEnd },
        ...(canSeeAll ? {} : { assignedToId: actor.id }),
      },
      select: { id: true, title: true, dueDate: true },
    }),
    prisma.project.findMany({
      where: {
        ...projectAccessWhere(actor),
        endDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true, name: true, endDate: true },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...meetings.map((m) => ({ id: m.id, type: "meeting" as const, title: m.title, date: m.date, href: "/meetings" })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "task_deadline" as const,
      title: t.title,
      date: t.dueDate!,
      href: `/tasks/${t.id}`,
    })),
    ...projects.map((p) => ({
      id: p.id,
      type: "project_milestone" as const,
      title: `${p.name} — deadline`,
      date: p.endDate!,
      href: `/projects/${p.id}`,
    })),
  ];

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
