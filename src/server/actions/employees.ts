"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requirePermission, requireAuth, type SessionUser } from "@/lib/permissions/check";
import { createNotification } from "@/lib/notifications/create";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";
import { canAssignRoleLevel, canManageLevel, employeeLevel } from "@/lib/permissions/hierarchy";
import { invalidateAuthUserContext } from "@/lib/auth/get-user-context";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/lib/validations/employee";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

const ABOVE_YOUR_LEVEL = "You can only manage employees whose role is below your own level.";

/** Loads a target employee with their role and checks the actor outranks them. */
async function loadManageableEmployee(actor: SessionUser, id: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      role: { select: { level: true } },
      userRoles: { select: { roleId: true, role: { select: { level: true } } } },
    },
  });
  if (!target || target.deletedAt) return { ok: false, error: "Employee not found." } as const;
  if (target.id !== actor.id && !canManageLevel(actor, employeeLevel(target))) {
    return { ok: false, error: ABOVE_YOUR_LEVEL } as const;
  }
  return { ok: true, target } as const;
}

/**
 * Validates a requested set of extra roles. Each must exist, be active, not be a system role (Super Admin is
 * never granted this way), not duplicate the primary role, and sit below the actor's own level.
 */
async function validateExtraRoles(actor: SessionUser, primaryRoleId: string, requested: string[]) {
  const ids = [...new Set(requested)].filter((id) => id !== primaryRoleId);
  if (ids.length === 0) return { ok: true, ids } as const;

  const roles = await prisma.role.findMany({ where: { id: { in: ids }, isActive: true, deletedAt: null } });
  if (roles.length !== ids.length) return { ok: false, error: "One of the additional roles was not found." } as const;
  if (roles.some((r) => r.isSystem)) {
    return { ok: false, error: "System roles (Super Admin) can't be granted as an additional role." } as const;
  }
  if (roles.some((r) => !canAssignRoleLevel(actor, r.level))) {
    return { ok: false, error: "You can only assign roles below your own level." } as const;
  }
  return { ok: true, ids } as const;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.USER_CREATE);

  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const [duplicateId, duplicateEmail] = await Promise.all([
    prisma.user.findUnique({ where: { employeeId: data.employeeId } }),
    prisma.user.findUnique({ where: { email: data.email } }),
  ]);
  if (duplicateId) return { success: false, error: "Employee ID is already in use." };
  if (duplicateEmail) return { success: false, error: "Email is already in use." };

  const role = await prisma.role.findFirst({ where: { id: data.roleId, deletedAt: null } });
  if (!role) return { success: false, error: "Role not found." };
  if (!canAssignRoleLevel(actor, role.level)) {
    return { success: false, error: "You can only assign roles below your own level." };
  }

  const extras = await validateExtraRoles(actor, data.roleId, data.additionalRoleIds ?? []);
  if (!extras.ok) return { success: false, error: extras.error };

  const employee = await prisma.user.create({
    data: {
      userRoles: { create: extras.ids.map((roleId) => ({ roleId, assignedById: actor.id })) },
      employeeId: data.employeeId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      image: data.image || null,
      departmentId: data.departmentId || null,
      designationId: data.designationId || null,
      roleId: data.roleId,
      managerId: data.managerId || null,
      joiningDate: data.joiningDate ?? null,
      employmentStatus: data.employmentStatus,
      accountStatus: data.accountStatus,
      notes: data.notes || null,
    },
    select: { id: true },
  });

  await logActivity({
    userId: actor.id,
    action: "employee.created",
    entityType: "User",
    entityId: employee.id,
    description: `${actor.name ?? actor.email} created employee ${data.employeeId} (${data.name})`,
    metadata: { employeeId: data.employeeId, email: data.email, roleId: data.roleId },
  });

  revalidatePath("/employees");
  return { success: true, data: { id: employee.id } };
}

export async function updateEmployee(input: UpdateEmployeeInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.USER_UPDATE);

  const parsed = updateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;

  const loaded = await loadManageableEmployee(actor, id);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const existing = loaded.target;

  if (data.roleId && data.roleId !== existing.roleId) {
    if (existing.id === actor.id) return { success: false, error: "You can't change your own role." };
    const newRole = await prisma.role.findFirst({ where: { id: data.roleId, deletedAt: null } });
    if (!newRole) return { success: false, error: "Role not found." };
    if (!canAssignRoleLevel(actor, newRole.level)) {
      return { success: false, error: "You can only assign roles below your own level." };
    }
  }

  // Extra roles: the actor can only add/remove roles they outrank. Existing extras above their level are kept.
  let extraRolesChanged = false;
  let finalExtraIds: string[] | null = null;
  const primaryRoleId = data.roleId ?? existing.roleId ?? "";
  if (data.additionalRoleIds !== undefined) {
    const validated = await validateExtraRoles(actor, primaryRoleId, data.additionalRoleIds);
    if (!validated.ok) return { success: false, error: validated.error };

    const keptOutOfReach = existing.userRoles
      .filter((ur) => !canAssignRoleLevel(actor, ur.role.level) && ur.roleId !== primaryRoleId)
      .map((ur) => ur.roleId);
    finalExtraIds = [...new Set([...keptOutOfReach, ...validated.ids])];

    const before = new Set(existing.userRoles.map((ur) => ur.roleId));
    extraRolesChanged = finalExtraIds.length !== before.size || finalExtraIds.some((id) => !before.has(id));
    if (extraRolesChanged && existing.id === actor.id) {
      return { success: false, error: "You can't change your own roles." };
    }
  } else if (
    data.roleId &&
    data.roleId !== existing.roleId &&
    existing.userRoles.some((ur) => ur.roleId === data.roleId)
  ) {
    // Promoting an extra role to primary: it no longer needs to be listed as an extra.
    finalExtraIds = existing.userRoles.map((ur) => ur.roleId).filter((id) => id !== data.roleId);
    extraRolesChanged = true;
  }

  if (data.employeeId && data.employeeId !== existing.employeeId) {
    const dup = await prisma.user.findUnique({ where: { employeeId: data.employeeId } });
    if (dup) return { success: false, error: "Employee ID is already in use." };
  }
  if (data.email && data.email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: data.email } });
    if (dup) return { success: false, error: "Email is already in use." };
  }

  const roleChanged = data.roleId && data.roleId !== existing.roleId;
  const statusChanged = data.accountStatus && data.accountStatus !== existing.accountStatus;

  const currentExtraIds = existing.userRoles.map((ur) => ur.roleId);
  await prisma.user.update({
    where: { id },
    data: {
      ...(finalExtraIds && {
        userRoles: {
          deleteMany: { roleId: { notIn: finalExtraIds } },
          create: finalExtraIds
            .filter((roleId) => !currentExtraIds.includes(roleId))
            .map((roleId) => ({ roleId, assignedById: actor.id })),
        },
      }),
      ...(data.employeeId !== undefined && { employeeId: data.employeeId }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.image !== undefined && { image: data.image || null }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
      ...(data.designationId !== undefined && { designationId: data.designationId || null }),
      ...(data.roleId !== undefined && { roleId: data.roleId }),
      ...(data.managerId !== undefined && { managerId: data.managerId || null }),
      ...(data.joiningDate !== undefined && { joiningDate: data.joiningDate }),
      ...(data.employmentStatus !== undefined && { employmentStatus: data.employmentStatus }),
      ...(data.accountStatus !== undefined && { accountStatus: data.accountStatus }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (roleChanged || statusChanged || extraRolesChanged) {
    await invalidateAuthUserContext(id);
  }

  // Tell the person (their open session also picks the change up within seconds, see SessionSyncWatcher).
  if ((roleChanged || extraRolesChanged) && existing.id !== actor.id) {
    await createNotification({
      userId: existing.id,
      type: "ROLE_CHANGED",
      title: "Your role was updated",
      message: `${actor.name ?? actor.email} changed your role assignments. Use the user menu to switch between your roles.`,
      entityType: "User",
      entityId: existing.id,
    });
  }

  await logActivity({
    userId: actor.id,
    action: "employee.updated",
    entityType: "User",
    entityId: id,
    description: `${actor.name ?? actor.email} updated employee ${existing.employeeId ?? existing.email}`,
    metadata: { changes: data },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { success: true, data: undefined };
}

export async function deactivateEmployee(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.USER_DELETE);

  if (id === actor.id) return { success: false, error: "You can't deactivate or delete your own account." };
  const loaded = await loadManageableEmployee(actor, id);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const existing = loaded.target;

  await prisma.user.update({
    where: { id },
    data: { accountStatus: "INACTIVE" },
  });
  await invalidateAuthUserContext(id);

  await logActivity({
    userId: actor.id,
    action: "employee.deactivated",
    entityType: "User",
    entityId: id,
    description: `${actor.name ?? actor.email} deactivated employee ${existing.employeeId ?? existing.email}`,
  });

  revalidatePath("/employees");
  return { success: true, data: undefined };
}

export async function softDeleteEmployee(id: string): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.USER_DELETE);

  if (id === actor.id) return { success: false, error: "You can't deactivate or delete your own account." };
  const loaded = await loadManageableEmployee(actor, id);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const existing = loaded.target;

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), accountStatus: "INACTIVE" },
  });
  await invalidateAuthUserContext(id);

  await logActivity({
    userId: actor.id,
    action: "employee.deleted",
    entityType: "User",
    entityId: id,
    description: `${actor.name ?? actor.email} deleted employee ${existing.employeeId ?? existing.email}`,
  });

  revalidatePath("/employees");
  return { success: true, data: undefined };
}

/** Every authenticated employee can view their own profile, regardless of user.view permission. */
export async function getMyProfile() {
  const actor = await requireAuth();
  return prisma.user.findUnique({
    where: { id: actor.id },
    include: {
      department: true,
      designation: true,
      role: true,
      userRoles: { include: { role: true }, orderBy: { assignedAt: "asc" } },
      manager: true,
      tasksAssigned: { where: { deletedAt: null }, include: { project: true }, orderBy: { createdAt: "desc" }, take: 10 },
      projectMemberships: { include: { project: true } },
    },
  });
}

export async function getEmployeeDetail(id: string) {
  const actor = await requirePermission(PERMISSIONS.USER_VIEW);

  return prisma.user.findUnique({
    where: { id },
    include: {
      department: true,
      designation: true,
      role: true,
      userRoles: { include: { role: true }, orderBy: { assignedAt: "asc" } },
      manager: true,
      tasksAssigned: {
        where: { deletedAt: null },
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      // Only list projects the viewer is themselves allowed to see.
      projectMemberships: { where: { project: projectAccessWhere(actor) }, include: { project: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
}

export async function listEmployees(params?: { departmentId?: string; search?: string }) {
  await requirePermission(PERMISSIONS.USER_VIEW);

  return prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(params?.departmentId && { departmentId: params.departmentId }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search } },
          { email: { contains: params.search } },
          { employeeId: { contains: params.search } },
        ],
      }),
    },
    include: {
      department: true,
      designation: true,
      role: true,
      manager: true,
      userRoles: { include: { role: true }, orderBy: { assignedAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}
