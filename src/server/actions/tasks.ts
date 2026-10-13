"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requireAuth, requirePermission, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAccessProject } from "@/lib/permissions/project-access";
import { createNotification } from "@/lib/notifications/create";
import { recalculateProjectProgress } from "./projects";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskProgressSchema,
  createTaskCommentSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskProgressInput,
  type CreateTaskCommentInput,
} from "@/lib/validations/task";
import type { ActionResult } from "./employees";

export async function createTask(input: CreateTaskInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.TASK_CREATE);

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  if (data.projectId && !(await canAccessProject(actor, data.projectId))) {
    return { success: false, error: "Project not found." };
  }

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId || null,
      title: data.title,
      description: data.description || null,
      assignedToId: data.assignedToId || null,
      assignedById: actor.id,
      priority: data.priority,
      status: data.status,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
      estimatedHours: data.estimatedHours ?? null,
    },
    select: { id: true, title: true, projectId: true },
  });

  if (data.assignedToId) {
    await createNotification({
      userId: data.assignedToId,
      type: "TASK_ASSIGNED",
      title: "New task assigned",
      message: `${actor.name ?? actor.email} assigned you: "${task.title}"`,
      entityType: "Task",
      entityId: task.id,
    });
  }

  await logActivity({
    userId: actor.id,
    action: "task.created",
    entityType: "Task",
    entityId: task.id,
    description: `${actor.name ?? actor.email} created task "${task.title}"`,
  });

  if (task.projectId) await recalculateProjectProgress(task.projectId);

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: { id: task.id } };
}

export async function assignTask(taskId: string, assigneeId: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.TASK_ASSIGN);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.deletedAt) return { success: false, error: "Task not found." };

  await prisma.task.update({ where: { id: taskId }, data: { assignedToId: assigneeId } });

  await createNotification({
    userId: assigneeId,
    type: "TASK_ASSIGNED",
    title: "Task assigned to you",
    message: `${actor.name ?? actor.email} assigned you: "${task.title}"`,
    entityType: "Task",
    entityId: taskId,
  });

  await logActivity({
    userId: actor.id,
    action: "task.assigned",
    entityType: "Task",
    entityId: taskId,
    description: `${actor.name ?? actor.email} assigned task "${task.title}" to a new employee`,
    metadata: { assigneeId },
  });

  revalidatePath("/tasks");
  return { success: true, data: undefined };
}

export async function updateTask(input: UpdateTaskInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.TASK_UPDATE);

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, ...data } = parsed.data;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "Task not found." };

  const isOwnTaskOnlyUpdate = existing.assignedToId === actor.id && !hasPermission(actor, PERMISSIONS.TASK_ASSIGN);
  if (isOwnTaskOnlyUpdate && data.assignedToId && data.assignedToId !== existing.assignedToId) {
    return { success: false, error: "You do not have permission to reassign this task." };
  }

  if (data.projectId && data.projectId !== existing.projectId && !(await canAccessProject(actor, data.projectId))) {
    return { success: false, error: "Project not found." };
  }

  await prisma.task.update({
    where: { id },
    data: {
      ...(data.projectId !== undefined && { projectId: data.projectId || null }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
      ...(data.actualHours !== undefined && { actualHours: data.actualHours }),
    },
  });

  await logActivity({
    userId: actor.id,
    action: "task.updated",
    entityType: "Task",
    entityId: id,
    description: `${actor.name ?? actor.email} updated task "${existing.title}"`,
    metadata: { changes: data },
  });

  if (existing.projectId) await recalculateProjectProgress(existing.projectId);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { success: true, data: undefined };
}

/**
 * Employees update their own task progress; this creates an immutable
 * TaskProgressUpdate history entry alongside the mutable Task row, so
 * managers can see "40% -> 70%" style history (see spec section 14).
 */
export async function updateTaskProgress(input: UpdateTaskProgressInput): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = updateTaskProgressSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { taskId, progress, status, note } = parsed.data;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.deletedAt) return { success: false, error: "Task not found." };

  const isAssignee = task.assignedToId === actor.id;
  const canUpdateAny = hasPermission(actor, PERMISSIONS.TASK_UPDATE);
  if (!isAssignee && !canUpdateAny) {
    return { success: false, error: "You do not have permission to update this task." };
  }

  const newStatus = status ?? (progress === 100 ? "COMPLETED" : task.status === "TODO" ? "IN_PROGRESS" : task.status);
  const isCompleting = newStatus === "COMPLETED" && task.status !== "COMPLETED";

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: {
        progress,
        status: newStatus,
        completedAt: isCompleting ? new Date() : task.completedAt,
      },
    }),
    prisma.taskProgressUpdate.create({
      data: {
        taskId,
        userId: actor.id,
        previousProgress: task.progress,
        newProgress: progress,
        previousStatus: task.status,
        newStatus,
        note: note || null,
      },
    }),
  ]);

  await logActivity({
    userId: actor.id,
    action: "task.progress_updated",
    entityType: "Task",
    entityId: taskId,
    description: `${actor.name ?? actor.email} changed progress on "${task.title}": ${task.progress}% -> ${progress}%`,
    metadata: { previousProgress: task.progress, newProgress: progress, note },
  });

  if (isCompleting) {
    await logActivity({
      userId: actor.id,
      action: "task.completed",
      entityType: "Task",
      entityId: taskId,
      description: `${actor.name ?? actor.email} completed task "${task.title}"`,
    });
    if (task.assignedById !== actor.id) {
      await createNotification({
        userId: task.assignedById,
        type: "TASK_COMPLETED",
        title: "Task completed",
        message: `"${task.title}" was marked as completed.`,
        entityType: "Task",
        entityId: taskId,
      });
    }
  }

  if (task.projectId) await recalculateProjectProgress(task.projectId);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, data: undefined };
}

export async function completeTask(taskId: string): Promise<ActionResult> {
  const actor = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: "Task not found." };

  if (task.assignedToId !== actor.id && !hasPermission(actor, PERMISSIONS.TASK_COMPLETE)) {
    return { success: false, error: "You do not have permission to complete this task." };
  }

  return updateTaskProgress({ taskId, progress: 100, status: "COMPLETED" });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.TASK_DELETE);
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Task not found." };

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: actor.id,
    action: "task.deleted",
    entityType: "Task",
    entityId: id,
    description: `${actor.name ?? actor.email} deleted task "${existing.title}"`,
  });

  if (existing.projectId) await recalculateProjectProgress(existing.projectId);

  revalidatePath("/tasks");
  return { success: true, data: undefined };
}

export async function addTaskComment(input: CreateTaskCommentInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.TASK_VIEW);

  const parsed = createTaskCommentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { taskId, message } = parsed.data;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: "Task not found." };

  const comment = await prisma.taskComment.create({
    data: { taskId, userId: actor.id, message },
    select: { id: true },
  });

  const notifyUserId = task.assignedToId === actor.id ? task.assignedById : task.assignedToId;
  if (notifyUserId && notifyUserId !== actor.id) {
    await createNotification({
      userId: notifyUserId,
      type: "MENTION",
      title: "New comment on your task",
      message: `${actor.name ?? actor.email} commented on "${task.title}"`,
      entityType: "Task",
      entityId: taskId,
    });
  }

  await logActivity({
    userId: actor.id,
    action: "task.comment_added",
    entityType: "Task",
    entityId: taskId,
    description: `${actor.name ?? actor.email} commented on "${task.title}"`,
  });

  revalidatePath(`/tasks/${taskId}`);
  return { success: true, data: { id: comment.id } };
}

export async function listTasks(params?: { projectId?: string; assignedToId?: string; status?: string }) {
  const actor = await requirePermission(PERMISSIONS.TASK_VIEW);

  return prisma.task.findMany({
    where: {
      deletedAt: null,
      ...(params?.projectId && { projectId: params.projectId }),
      ...(params?.status && { status: params.status as never }),
      ...(params?.assignedToId
        ? { assignedToId: params.assignedToId }
        : !actor.isAdmin && !hasPermission(actor, PERMISSIONS.USER_VIEW)
          ? { assignedToId: actor.id }
          : {}),
    },
    // Only id + name: assignees who are not project members must not receive the project's details.
    include: { project: { select: { id: true, name: true } }, assignedTo: true, assignedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTaskDetail(id: string) {
  await requirePermission(PERMISSIONS.TASK_VIEW);
  return prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: true,
      assignedBy: true,
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      progressUpdates: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
}
