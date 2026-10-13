"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/permissions/check";

export interface SwitchableRole {
  id: string;
  name: string;
  level: number;
  /**
   * "assigned": a role an admin gave this user (full authority of that role).
   * "preview": a lower role they can try out; access is limited to what they already have.
   */
  kind: "assigned" | "preview";
  /** The user's primary role, the one they get at sign-in. */
  isPrimary: boolean;
  /** The role being used right now. */
  isCurrent: boolean;
}

/**
 * Roles the signed-in user may work as without signing out. This only feeds the menu: the session callback
 * re-validates whatever is chosen, so this list is not what grants anything.
 */
export async function listSwitchableRoles(): Promise<SwitchableRole[]> {
  const actor = await requireAuth();

  const me = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      roleId: true,
      isAdmin: true,
      userRoles: { select: { roleId: true } },
    },
  });
  if (!me) return [];

  const assignedIds = new Set([...(me.roleId ? [me.roleId] : []), ...me.userRoles.map((ur) => ur.roleId)]);

  const assignedRoles = await prisma.role.findMany({
    where: { id: { in: [...assignedIds] }, isActive: true, deletedAt: null },
    select: { id: true, name: true, level: true },
  });
  const maxAssignedLevel = Math.max(0, ...assignedRoles.map((r) => r.level));

  const previewRoles = await prisma.role.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      id: { notIn: [...assignedIds] },
      ...(me.isAdmin ? {} : { level: { lt: maxAssignedLevel } }),
    },
    select: { id: true, name: true, level: true },
  });

  const toRow = (r: { id: string; name: string; level: number }, kind: SwitchableRole["kind"]): SwitchableRole => ({
    ...r,
    kind,
    isPrimary: r.id === me.roleId,
    isCurrent: r.id === actor.roleId,
  });

  return [...assignedRoles.map((r) => toRow(r, "assigned")), ...previewRoles.map((r) => toRow(r, "preview"))].sort(
    (a, b) => b.level - a.level || a.name.localeCompare(b.name),
  );
}
