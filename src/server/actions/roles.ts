"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requirePermission, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAssignRoleLevel } from "@/lib/permissions/hierarchy";
import { invalidateAuthContextForRole } from "@/lib/auth/get-user-context";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRolePermissionsSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createDesignationSchema,
  updateDesignationSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
  type AssignRolePermissionsInput,
  type CreateDepartmentInput,
  type CreateDesignationInput,
} from "@/lib/validations/role";
import type { ActionResult } from "./employees";

export async function createRole(input: CreateRoleInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.ROLE_CREATE);

  const parsed = createRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!canAssignRoleLevel(actor, parsed.data.level)) {
    return { success: false, error: "You can only create roles below your own level." };
  }

  const existing = await prisma.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "A role with this name already exists." };

  const role = await prisma.role.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive,
      level: parsed.data.level,
    },
  });

  await logActivity({
    userId: actor.id,
    action: "role.created",
    entityType: "Role",
    entityId: role.id,
    description: `${actor.name ?? actor.email} created role "${role.name}"`,
  });

  revalidatePath("/roles");
  return { success: true, data: { id: role.id } };
}

export async function updateRole(input: UpdateRoleInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.ROLE_UPDATE);

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Role not found." };
  if (existing.isSystem) return { success: false, error: "System roles cannot be modified." };
  if (!canAssignRoleLevel(actor, existing.level)) {
    return { success: false, error: "You can only edit roles below your own level." };
  }
  if (data.level !== undefined && !canAssignRoleLevel(actor, data.level)) {
    return { success: false, error: "You can only set a level below your own." };
  }

  await prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.level !== undefined && { level: data.level }),
    },
  });

  if (data.isActive !== undefined || data.level !== undefined) {
    await invalidateAuthContextForRole(id);
  }

  await logActivity({
    userId: actor.id,
    action: "role.updated",
    entityType: "Role",
    entityId: id,
    description: `${actor.name ?? actor.email} updated role "${existing.name}"`,
  });

  revalidatePath("/roles");
  return { success: true, data: undefined };
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.ROLE_DELETE);

  const existing = await prisma.role.findUnique({
    where: { id },
    include: { users: { select: { id: true } }, userRoles: { select: { id: true } } },
  });
  if (!existing) return { success: false, error: "Role not found." };
  if (existing.isSystem) return { success: false, error: "System roles cannot be deleted." };
  if (!canAssignRoleLevel(actor, existing.level)) {
    return { success: false, error: "You can only delete roles below your own level." };
  }
  if (existing.users.length > 0 || existing.userRoles.length > 0) {
    return { success: false, error: "Cannot delete a role that is still assigned to employees." };
  }

  await prisma.role.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

  await logActivity({
    userId: actor.id,
    action: "role.deleted",
    entityType: "Role",
    entityId: id,
    description: `${actor.name ?? actor.email} deleted role "${existing.name}"`,
  });

  revalidatePath("/roles");
  return { success: true, data: undefined };
}

export async function assignRolePermissions(input: AssignRolePermissionsInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.PERMISSION_ASSIGN);

  const parsed = assignRolePermissionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { roleId, permissionKeys } = parsed.data;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { success: false, error: "Role not found." };
  if (role.isSystem) {
    return { success: false, error: "Super Admin permissions cannot be changed." };
  }
  if (!canAssignRoleLevel(actor, role.level)) {
    return { success: false, error: "You can only change permissions of roles below your own level." };
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  });

  // You can't hand out powers you don't hold yourself (otherwise a role editor could escalate).
  if (!actor.isAdmin) {
    const current = new Set(
      (await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: { select: { key: true } } } })).map(
        (rp) => rp.permission.key,
      ),
    );
    const notHeld = permissions.filter((p) => !current.has(p.key) && !hasPermission(actor, p.key as never));
    if (notHeld.length > 0) {
      return { success: false, error: `You can't grant permissions you don't have: ${notHeld.map((p) => p.key).join(", ")}` };
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  await invalidateAuthContextForRole(roleId);

  await logActivity({
    userId: actor.id,
    action: "role.permissions_assigned",
    entityType: "Role",
    entityId: roleId,
    description: `${actor.name ?? actor.email} updated permissions for role "${role.name}"`,
    metadata: { permissionKeys: permissions.map((p) => p.key) },
  });

  revalidatePath("/roles");
  revalidatePath(`/roles/${roleId}`);
  return { success: true, data: undefined };
}

export async function listRoles() {
  await requirePermission(PERMISSIONS.ROLE_VIEW);
  return prisma.role.findMany({
    where: { deletedAt: null },
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: [{ level: "desc" }, { name: "asc" }],
  });
}

export async function getRoleById(id: string) {
  await requirePermission(PERMISSIONS.ROLE_VIEW);
  return prisma.role.findUnique({
    where: { id },
    include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
  });
}

export async function listPermissions() {
  await requirePermission(PERMISSIONS.PERMISSION_VIEW);
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] });
}

// --- Departments -----------------------------------------------------------

export async function createDepartment(input: CreateDepartmentInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENT_MANAGE);
  const parsed = createDepartmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const existing = await prisma.department.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "Department already exists." };

  const department = await prisma.department.create({
    data: { name: parsed.data.name, description: parsed.data.description || null, isActive: parsed.data.isActive },
  });

  await logActivity({
    userId: actor.id,
    action: "department.created",
    entityType: "Department",
    entityId: department.id,
    description: `${actor.name ?? actor.email} created department "${department.name}"`,
  });

  revalidatePath("/departments");
  return { success: true, data: { id: department.id } };
}

export async function updateDepartment(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENT_MANAGE);
  const parsed = updateDepartmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, ...data } = parsed.data;

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Department not found." };

  await prisma.department.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await logActivity({
    userId: actor.id,
    action: "department.updated",
    entityType: "Department",
    entityId: id,
    description: `${actor.name ?? actor.email} updated department "${existing.name}"`,
  });

  revalidatePath("/departments");
  return { success: true, data: undefined };
}

export async function listDepartments() {
  await requirePermission(PERMISSIONS.DEPARTMENT_VIEW);
  return prisma.department.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
}

// --- Designations ------------------------------------------------------------

export async function createDesignation(input: CreateDesignationInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.DESIGNATION_MANAGE);
  const parsed = createDesignationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const existing = await prisma.designation.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "Designation already exists." };

  const designation = await prisma.designation.create({
    data: { name: parsed.data.name, description: parsed.data.description || null, isActive: parsed.data.isActive },
  });

  await logActivity({
    userId: actor.id,
    action: "designation.created",
    entityType: "Designation",
    entityId: designation.id,
    description: `${actor.name ?? actor.email} created designation "${designation.name}"`,
  });

  revalidatePath("/designations");
  return { success: true, data: { id: designation.id } };
}

export async function updateDesignation(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.DESIGNATION_MANAGE);
  const parsed = updateDesignationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, ...data } = parsed.data;

  const existing = await prisma.designation.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Designation not found." };

  await prisma.designation.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await logActivity({
    userId: actor.id,
    action: "designation.updated",
    entityType: "Designation",
    entityId: id,
    description: `${actor.name ?? actor.email} updated designation "${existing.name}"`,
  });

  revalidatePath("/designations");
  return { success: true, data: undefined };
}

export async function listDesignations() {
  await requirePermission(PERMISSIONS.DESIGNATION_VIEW);
  return prisma.designation.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
}
