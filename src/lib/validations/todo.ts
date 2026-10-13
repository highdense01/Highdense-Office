import { z } from "zod";
import { priorityEnum } from "./project";

export const todoStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]);

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  priority: priorityEnum.default("MEDIUM"),
  dueDate: z.coerce.date().optional().nullable(),
});
export type CreateTodoInput = z.infer<typeof createTodoSchema>;

export const updateTodoSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().optional().nullable(),
  status: todoStatusEnum.optional(),
});
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
