import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis/client";
import type { PermissionKey } from "@/lib/permissions/constants";
import type { AccountStatus } from "@prisma/client";

export interface AuthUserContext {
  userId: string;
  employeeId: string | null;
  /** Effective (active) role: the one being worked as right now. */
  roleId: string | null;
  roleName: string | null;
  roleLevel: number;
  permissions: PermissionKey[];
  isAdmin: boolean;
  accountStatus: AccountStatus;
  departmentId: string | null;
  /** The user's primary role: their default at sign-in. */
  realRoleId: string | null;
  realRoleName: string | null;
  realRoleLevel: number;
  realIsAdmin: boolean;
  /** True while the active role is not the primary one (an assigned role, or a lower role being previewed). */
  isActingAs: boolean;
  /** There is at least one other role this user can switch to. */
  canSwitchRole: boolean;
  /** Names of every role the user holds (primary first), for display. */
  assignedRoleNames: string[];
  /** The requested role switch was not allowed (any more) and was ignored. */
  actingRoleRejected: boolean;
}

const CONTEXT_CACHE_TTL_SECONDS = 30;

function cacheKey(userId: string) {
  return `auth:context:${userId}`;
}

type RoleRow = {
  id: string;
  name: string;
  level: number;
  rolePermissions: { permission: { key: string } }[];
};

const roleSelect = {
  id: true,
  name: true,
  level: true,
  rolePermissions: { select: { permission: { select: { key: true } } } },
} as const;

const keysOf = (role: RoleRow) => role.rolePermissions.map((rp) => rp.permission.key) as PermissionKey[];

/**
 * Loads a user's role + permissions fresh from MySQL (the source of truth),
 * with a short-lived Redis cache to avoid a DB round trip on every request.
 * Called from the NextAuth `jwt` callback so permission changes made by an
 * admin propagate to active sessions without requiring users to sign out.
 *
 * A user has a PRIMARY role (User.roleId, used at sign-in) plus any number of ASSIGNED roles (UserRole).
 * `actingRoleId` is the role they have chosen to work as. It is re-validated on every load, so it can
 * never outlive a revoked assignment or a demotion:
 *  - an ASSIGNED role gives that role's full permissions and level (an admin granted it);
 *  - any other role is a PREVIEW of a lower role: strictly below the user's highest assigned level
 *    (Super Admins: any role), and permissions are intersected with what the user already has, so a
 *    preview can only ever narrow access;
 *  - the Super Admin bypass (`isAdmin`) only applies while working as the primary role.
 */
export async function loadAuthUserContext(
  userId: string,
  actingRoleId?: string | null,
): Promise<AuthUserContext | null> {
  const wantsActing = Boolean(actingRoleId);

  if (redis && !wantsActing) {
    const cached = await redis.get<AuthUserContext>(cacheKey(userId));
    if (cached) return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      employeeId: true,
      isAdmin: true,
      accountStatus: true,
      departmentId: true,
      roleId: true,
      role: { select: { ...roleSelect, isActive: true, deletedAt: true } },
      userRoles: {
        select: { role: { select: { ...roleSelect, isActive: true, deletedAt: true } } },
      },
    },
  });

  if (!user) return null;

  const usable = <T extends { isActive: boolean; deletedAt: Date | null }>(r: T | null | undefined) =>
    r && r.isActive && !r.deletedAt ? r : null;

  const primary = usable(user.role);
  const assigned: RoleRow[] = [primary, ...user.userRoles.map((ur) => usable(ur.role))].filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );
  const assignedIds = new Set(assigned.map((r) => r.id));
  const maxAssignedLevel = Math.max(0, ...assigned.map((r) => r.level));
  const ownPermissions = new Set(assigned.flatMap(keysOf));

  let acting: { id: string; name: string; level: number; permissions: PermissionKey[] } | null = null;
  let actingRoleRejected = false;

  if (wantsActing && actingRoleId !== user.roleId) {
    const assignedMatch = assigned.find((r) => r.id === actingRoleId);
    if (assignedMatch) {
      acting = {
        id: assignedMatch.id,
        name: assignedMatch.name,
        level: assignedMatch.level,
        permissions: keysOf(assignedMatch),
      };
    } else {
      const target = await prisma.role.findFirst({
        where: { id: actingRoleId!, isActive: true, deletedAt: null },
        select: roleSelect,
      });
      if (target && (user.isAdmin || target.level < maxAssignedLevel)) {
        const targetPermissions = keysOf(target);
        acting = {
          id: target.id,
          name: target.name,
          level: target.level,
          permissions: user.isAdmin ? targetPermissions : targetPermissions.filter((p) => ownPermissions.has(p)),
        };
      } else {
        actingRoleRejected = true;
      }
    }
  }

  // Is there anywhere to switch to? Another assigned role, or a role below the user's level to preview.
  let canSwitchRole = assigned.length > 1;
  if (!canSwitchRole) {
    const lowerRoles = await prisma.role.count({
      where: {
        isActive: true,
        deletedAt: null,
        id: { notIn: [...assignedIds] },
        ...(user.isAdmin ? {} : { level: { lt: maxAssignedLevel } }),
      },
    });
    canSwitchRole = lowerRoles > 0;
  }

  const context: AuthUserContext = {
    userId: user.id,
    employeeId: user.employeeId,
    roleId: acting ? acting.id : user.roleId,
    roleName: acting ? acting.name : (user.role?.name ?? null),
    roleLevel: acting ? acting.level : (primary?.level ?? 0),
    permissions: acting ? acting.permissions : primary ? keysOf(primary) : [],
    isAdmin: acting ? false : user.isAdmin,
    accountStatus: user.accountStatus,
    departmentId: user.departmentId,
    realRoleId: user.roleId,
    realRoleName: user.role?.name ?? null,
    realRoleLevel: primary?.level ?? 0,
    realIsAdmin: user.isAdmin,
    isActingAs: acting !== null,
    canSwitchRole: canSwitchRole || acting !== null,
    assignedRoleNames: assigned.map((r) => r.name),
    actingRoleRejected,
  };

  if (redis && !wantsActing) {
    await redis.set(cacheKey(userId), context, { ex: CONTEXT_CACHE_TTL_SECONDS });
  }

  return context;
}

/** Call after any change to a user's role(s), a role's permissions, or account status. */
export async function invalidateAuthUserContext(userId: string) {
  if (!redis) return;
  await redis.del(cacheKey(userId));
}

/** Invalidate every cached context for users holding a given role, as primary or assigned. */
export async function invalidateAuthContextForRole(roleId: string) {
  if (!redis) return;
  const users = await prisma.user.findMany({
    where: { OR: [{ roleId }, { userRoles: { some: { roleId } } }] },
    select: { id: true },
  });
  await Promise.all(users.map((u) => invalidateAuthUserContext(u.id)));
}
