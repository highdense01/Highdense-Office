import { z } from "zod";

export const employmentStatusEnum = z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"]);
export const accountStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

export const createEmployeeSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(2, "Employee ID is required")
    .max(30)
    .regex(/^[A-Za-z0-9-_]+$/, "Employee ID may only contain letters, numbers, - and _"),
  name: z.string().trim().min(2, "Name is required").max(150),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  image: z.string().url().optional().or(z.literal("")),
  departmentId: z.string().min(1).optional().nullable(),
  designationId: z.string().min(1).optional().nullable(),
  roleId: z.string().min(1, "Role is required"),
  // Extra roles on top of the primary one. Undefined = leave as is (so no .default(): .partial() would apply it).
  additionalRoleIds: z.array(z.string().min(1)).optional(),
  managerId: z.string().min(1).optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  employmentStatus: employmentStatusEnum.default("ACTIVE"),
  accountStatus: accountStatusEnum.default("ACTIVE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
