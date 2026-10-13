"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requireAuth, requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAccessProject, projectAccessWhere } from "@/lib/permissions/project-access";
import { addTechSchema, pinNoteSchema, type AddTechInput } from "@/lib/validations/project-tech";
import type { ActionResult } from "./employees";

const OPEN_TASK_WHERE = {
  deletedAt: null,
  status: { notIn: ["COMPLETED", "CANCELLED"] as ("COMPLETED" | "CANCELLED")[] },
};

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------

export async function togglePinProject(projectId: string): Promise<ActionResult<{ pinned: boolean }>> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(actor) },
    select: { id: true },
  });
  if (!project) return { success: false, error: "Project not found." };

  const existing = await prisma.projectPin.findUnique({
    where: { projectId_userId: { projectId, userId: actor.id } },
  });

  if (existing) {
    await prisma.projectPin.delete({ where: { id: existing.id } });
  } else {
    await prisma.projectPin.create({ data: { projectId, userId: actor.id } });
  }

  revalidatePath("/projects");
  revalidatePath("/projects/pinned");
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { pinned: !existing } };
}

export async function updatePinNote(projectId: string, note: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);
  const parsed = pinNoteSchema.safeParse(note);
  if (!parsed.success) return { success: false, error: "Note is too long (max 500 characters)." };

  const result = await prisma.projectPin.updateMany({
    where: { projectId, userId: actor.id },
    data: { note: parsed.data || null },
  });
  if (result.count === 0) return { success: false, error: "Pin not found." };

  revalidatePath("/projects/pinned");
  return { success: true, data: undefined };
}

export async function listPinnedProjects() {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  const pins = await prisma.projectPin.findMany({
    where: { userId: actor.id, project: projectAccessWhere(actor) },
    orderBy: { pinnedAt: "desc" },
    include: {
      project: {
        include: {
          manager: true,
          techStack: { orderBy: { name: "asc" } },
          members: { include: { user: true } },
          _count: { select: { tasks: true } },
        },
      },
    },
  });

  const projectIds = pins.map((p) => p.projectId);
  const [openTasks, overdueTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, ...OPEN_TASK_WHERE },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, ...OPEN_TASK_WHERE, dueDate: { lt: new Date() } },
      _count: true,
    }),
  ]);
  const openBy = new Map(openTasks.map((t) => [t.projectId, t._count]));
  const overdueBy = new Map(overdueTasks.map((t) => [t.projectId, t._count]));

  return pins.map((pin) => ({
    ...pin,
    openTasks: openBy.get(pin.projectId) ?? 0,
    overdueTasks: overdueBy.get(pin.projectId) ?? 0,
  }));
}

export async function listPinnedProjectIds(): Promise<string[]> {
  const actor = await requireAuth();
  const pins = await prisma.projectPin.findMany({ where: { userId: actor.id }, select: { projectId: true } });
  return pins.map((p) => p.projectId);
}

// ---------------------------------------------------------------------------
// Tools & technologies
// ---------------------------------------------------------------------------

export async function addProjectTech(input: AddTechInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_UPDATE);

  const parsed = addTechSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { projectId, name, category, version, purpose, url } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(actor) },
    select: { name: true },
  });
  if (!project) return { success: false, error: "Project not found." };

  const duplicate = await prisma.projectTech.findUnique({ where: { projectId_name: { projectId, name } } });
  if (duplicate) return { success: false, error: `"${name}" is already on this project's stack.` };

  const tech = await prisma.projectTech.create({
    data: { projectId, name, category, version: version || null, purpose: purpose || null, url: url || null },
    select: { id: true },
  });

  await logActivity({
    userId: actor.id,
    action: "project.tech_added",
    entityType: "Project",
    entityId: projectId,
    description: `${actor.name ?? actor.email} added ${name} to the tech stack of "${project.name}"`,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tech-stack");
  revalidatePath("/projects/pinned");
  return { success: true, data: { id: tech.id } };
}

export async function removeProjectTech(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_UPDATE);

  const tech = await prisma.projectTech.findUnique({ where: { id }, include: { project: { select: { name: true } } } });
  if (!tech || !(await canAccessProject(actor, tech.projectId))) return { success: false, error: "Not found." };

  await prisma.projectTech.delete({ where: { id } });

  await logActivity({
    userId: actor.id,
    action: "project.tech_removed",
    entityType: "Project",
    entityId: tech.projectId,
    description: `${actor.name ?? actor.email} removed ${tech.name} from the tech stack of "${tech.project.name}"`,
  });

  revalidatePath(`/projects/${tech.projectId}`);
  revalidatePath("/tech-stack");
  revalidatePath("/projects/pinned");
  return { success: true, data: undefined };
}

/** Tech stack across every project the user can see, grouped by tool (case-insensitive name). */
export async function getTechOverview() {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  const rows = await prisma.projectTech.findMany({
    where: { project: projectAccessWhere(actor) },
    include: { project: { select: { id: true, name: true, status: true } } },
    orderBy: { name: "asc" },
  });

  const groups = new Map<
    string,
    {
      name: string;
      category: (typeof rows)[number]["category"];
      projects: { id: string; name: string; status: string; version: string | null; purpose: string | null }[];
    }
  >();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const group = groups.get(key) ?? { name: row.name, category: row.category, projects: [] };
    group.projects.push({
      id: row.project.id,
      name: row.project.name,
      status: row.project.status,
      version: row.version,
      purpose: row.purpose,
    });
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.projects.length - a.projects.length || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Pending / completed views
// ---------------------------------------------------------------------------

/** Projects that are not finished, with what's still outstanding on each. */
export async function getPendingProjects() {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  const projects = await prisma.project.findMany({
    where: { ...projectAccessWhere(actor), status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: {
      manager: true,
      tasks: {
        where: OPEN_TASK_WHERE,
        include: { assignedTo: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
  });

  const now = new Date();
  return projects.map((p) => ({
    ...p,
    overdueTasks: p.tasks.filter((t) => t.dueDate && t.dueDate < now).length,
    blockedTasks: p.tasks.filter((t) => t.status === "BLOCKED").length,
    isOverdue: !!p.endDate && p.endDate < now,
  }));
}

export async function getCompletedProjects() {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  const projects = await prisma.project.findMany({
    where: { ...projectAccessWhere(actor), status: "COMPLETED" },
    include: {
      manager: true,
      techStack: { orderBy: { name: "asc" } },
      tasks: { where: { deletedAt: null }, select: { status: true, actualHours: true } },
    },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
  });

  return projects.map((p) => {
    // Projects completed before completedAt existed fall back to their last update.
    const completedAt = p.completedAt ?? p.updatedAt;
    const counted = p.tasks.filter((t) => t.status !== "CANCELLED");
    return {
      ...p,
      completedAt,
      taskTotal: counted.length,
      taskDone: counted.filter((t) => t.status === "COMPLETED").length,
      hoursLogged: p.tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0),
      onTime: p.endDate ? completedAt <= p.endDate : null,
      durationDays: Math.max(
        1,
        Math.round((completedAt.getTime() - (p.startDate ?? p.createdAt).getTime()) / 86_400_000),
      ),
    };
  });
}
