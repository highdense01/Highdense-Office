import { z } from "zod";
import { priorityEnum } from "./project";

export const taskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "COMPLETED",
  "CANCELLED",
]);

export const createTaskSchema = z.object({
  projectId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(2, "Title is required").max(200),
  description: z.string().max(4000).optional().or(z.literal("")),
  assignedToId: z.string().min(1).optional().nullable(),
  priority: priorityEnum.default("MEDIUM"),
  status: taskStatusEnum.default("TODO"),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).max(10000).optional().nullable(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(4000).optional().or(z.literal("")),
  assignedToId: z.string().min(1).optional().nullable(),
  priority: priorityEnum.optional(),
  status: taskStatusEnum.optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).max(10000).optional().nullable(),
  actualHours: z.coerce.number().min(0).max(10000).optional().nullable(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateTaskProgressSchema = z.object({
  taskId: z.string().min(1),
  progress: z.coerce.number().int().min(0).max(100),
  status: taskStatusEnum.optional(),
  note: z.string().max(2000).optional().or(z.literal("")),
});
export type UpdateTaskProgressInput = z.infer<typeof updateTaskProgressSchema>;

export const createTaskCommentSchema = z.object({
  taskId: z.string().min(1),
  message: z.string().trim().min(1, "Comment cannot be empty").max(4000),
});
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
