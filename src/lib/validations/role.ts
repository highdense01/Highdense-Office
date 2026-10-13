import { z } from "zod";
import { MAX_CUSTOM_ROLE_LEVEL } from "@/lib/permissions/constants";

const roleLevel = z.number().int("Level must be a whole number").min(0).max(MAX_CUSTOM_ROLE_LEVEL, `Level can be at most ${MAX_CUSTOM_ROLE_LEVEL}`);

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name is required").max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  level: roleLevel.default(0),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// Written out (not createRoleSchema.partial()) because .partial() still applies
// .default() values, which would silently reset isActive/level on every update.
export const updateRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  level: roleLevel.optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const assignRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissionKeys: z.array(z.string()),
});
export type AssignRolePermissionsInput = z.infer<typeof assignRolePermissionsSchema>;

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  id: z.string().min(1),
});

export const createDesignationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;

export const updateDesignationSchema = createDesignationSchema.partial().extend({
  id: z.string().min(1),
});
