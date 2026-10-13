"use server";

import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requireAuth, requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  setEmployeePasswordSchema,
  changePasswordSchema,
  type SetEmployeePasswordInput,
  type ChangePasswordInput,
} from "@/lib/validations/auth";
import type { ActionResult } from "./employees";

/** Admin sets or resets another employee's password (e.g. when provisioning a new hire). */
export async function setEmployeePassword(input: SetEmployeePasswordInput): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.USER_UPDATE);

  const parsed = setEmployeePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { userId, password } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return { success: false, error: "Employee not found." };

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logActivity({
    userId: actor.id,
    action: "employee.password_set",
    entityType: "User",
    entityId: userId,
    description: `${actor.name ?? actor.email} set a password for ${target.name}`,
  });

  return { success: true, data: undefined };
}

/** Self-service password change. Requires the current password if one is already set. */
export async function changeMyPassword(input: ChangePasswordInput): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) return { success: false, error: "Account not found." };

  if (user.passwordHash) {
    if (!currentPassword) {
      return { success: false, error: "Enter your current password." };
    }
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) return { success: false, error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash } });

  await logActivity({
    userId: actor.id,
    action: "user.password_changed",
    entityType: "User",
    entityId: actor.id,
    description: `${actor.name ?? actor.email} changed their password`,
  });

  return { success: true, data: undefined };
}

export async function getMyPasswordStatus(): Promise<{ hasPassword: boolean }> {
  const actor = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  return { hasPassword: !!user?.passwordHash };
}
