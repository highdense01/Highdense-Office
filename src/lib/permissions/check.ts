import "server-only";
import { auth } from "@/lib/auth";
import type { PermissionKey } from "./constants";

export class UnauthorizedError extends Error {
  constructor(message = "You are not signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface SessionUser {
  id: string;
  employeeId: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  roleId: string | null;
  roleName: string | null;
  roleLevel: number;
  realRoleId: string | null;
  realRoleName: string | null;
  realRoleLevel: number;
  realIsAdmin: boolean;
  isActingAs: boolean;
  canSwitchRole: boolean;
  assignedRoleNames: string[];
  permissions: PermissionKey[];
  isAdmin: boolean;
  accountStatus: string;
  departmentId: string | null;
  isImpersonating: boolean;
}

/**
 * Resolves the current session. Every server action, route handler, and
 * server component that reads or mutates protected data must call this (or
 * requirePermission) — the sidebar/UI only ever *hides* actions, it never
 * enforces them.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.accountStatus !== "ACTIVE") {
    throw new ForbiddenError("Your account is not active. Contact an administrator.");
  }
  return session.user;
}

export function hasPermission(user: SessionUser, permission: PermissionKey): boolean {
  return user.isAdmin || user.permissions.includes(permission);
}

export function hasAnyPermission(user: SessionUser, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

/** Throws ForbiddenError if the signed-in user lacks the given permission. */
export async function requirePermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await requireAuth();
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

export async function requireAnyPermission(permissions: PermissionKey[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!hasAnyPermission(user, permissions)) {
    throw new ForbiddenError(`Missing one of permissions: ${permissions.join(", ")}`);
  }
  return user;
}
