import { z } from "zod";

export const projectStatusEnum = z.enum([
  "PLANNING",
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2, "Project name is required").max(200),
    description: z.string().max(4000).optional().or(z.literal("")),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    managerId: z.string().min(1).optional().nullable(),
    status: projectStatusEnum.default("PLANNING"),
    priority: priorityEnum.default("MEDIUM"),
    memberIds: z.array(z.string()).default([]),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(4000).optional().or(z.literal("")),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  managerId: z.string().min(1).optional().nullable(),
  status: projectStatusEnum.optional(),
  priority: priorityEnum.optional(),
  memberIds: z.array(z.string()).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
