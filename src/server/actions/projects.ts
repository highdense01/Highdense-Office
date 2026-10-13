"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validations/project";
import type { ActionResult } from "./employees";

export async function createProject(input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_CREATE);

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { memberIds, ...data } = parsed.data;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      managerId: data.managerId || null,
      status: data.status,
      priority: data.priority,
      createdById: actor.id,
      members: {
        create: [...new Set([...memberIds, ...(data.managerId ? [data.managerId] : [])])].map((userId) => ({
          userId,
        })),
      },
    },
    select: { id: true },
  });

  await logActivity({
    userId: actor.id,
    action: "project.created",
    entityType: "Project",
    entityId: project.id,
    description: `${actor.name ?? actor.email} created project "${data.name}"`,
  });

  revalidatePath("/projects");
  return { success: true, data: { id: project.id } };
}

export async function updateProject(input: UpdateProjectInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_UPDATE);

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, memberIds, ...data } = parsed.data;

  const existing = await prisma.project.findFirst({ where: { id, ...projectAccessWhere(actor) } });
  if (!existing) return { success: false, error: "Project not found." };

  await prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.managerId !== undefined && { managerId: data.managerId || null }),
      ...(data.status !== undefined && {
        status: data.status,
        completedAt: data.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(memberIds !== undefined && {
        members: {
          deleteMany: {},
          create: memberIds.map((userId) => ({ userId })),
        },
      }),
    },
  });

  await logActivity({
    userId: actor.id,
    action: "project.updated",
    entityType: "Project",
    entityId: id,
    description: `${actor.name ?? actor.email} updated project "${existing.name}"`,
    metadata: { changes: data },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: undefined };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.PROJECT_DELETE);

  const existing = await prisma.project.findFirst({ where: { id, ...projectAccessWhere(actor) } });
  if (!existing) return { success: false, error: "Project not found." };

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: actor.id,
    action: "project.deleted",
    entityType: "Project",
    entityId: id,
    description: `${actor.name ?? actor.email} deleted project "${existing.name}"`,
  });

  revalidatePath("/projects");
  return { success: true, data: undefined };
}

/** Recomputes and persists a project's cached progress from its tasks' average progress. */
export async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, status: { not: "CANCELLED" } },
    select: { progress: true },
  });
  if (tasks.length === 0) return;
  const average = Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length);
  await prisma.project.update({ where: { id: projectId }, data: { progress: average } });
}

export async function listProjects(params?: { status?: string; managerId?: string }) {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);

  return prisma.project.findMany({
    where: {
      ...projectAccessWhere(actor),
      ...(params?.status && { status: params.status as never }),
      ...(params?.managerId && { managerId: params.managerId }),
    },
    include: {
      manager: true,
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Returns null (-> 404) unless the caller manages, created, or is a member of the project. */
export async function getProjectDetail(id: string) {
  const actor = await requirePermission(PERMISSIONS.PROJECT_VIEW);
  return prisma.project.findFirst({
    where: { id, ...projectAccessWhere(actor) },
    include: {
      manager: true,
      createdBy: true,
      members: { include: { user: true } },
      tasks: { include: { assignedTo: true }, orderBy: { createdAt: "desc" } },
      techStack: { orderBy: { name: "asc" } },
    },
  });
}
