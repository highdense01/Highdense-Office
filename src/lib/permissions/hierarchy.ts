/**
 * Level-based role hierarchy (pure functions, safe to import on the client).
 *
 * Rule of thumb: you can only act on people and roles strictly BELOW your own
 * level. The `isAdmin` Super Admin flag sits above every level.
 */
export const SUPER_LEVEL = 1000;

interface LevelActor {
  isAdmin: boolean;
  roleLevel: number;
}

export function effectiveLevel(user: LevelActor): number {
  return user.isAdmin ? SUPER_LEVEL : user.roleLevel;
}

/**
 * Level of an employee record: the highest level among ALL roles they hold (primary + extra), since they
 * can switch to any of them. Super Admins outrank every role.
 */
export function employeeLevel(employee: {
  isAdmin: boolean;
  role?: { level: number } | null;
  userRoles?: { role: { level: number } }[];
}): number {
  if (employee.isAdmin) return SUPER_LEVEL;
  return Math.max(employee.role?.level ?? 0, ...(employee.userRoles ?? []).map((ur) => ur.role.level));
}

/** Can `actor` manage (edit / deactivate / delete) someone at `targetLevel`? */
export function canManageLevel(actor: LevelActor, targetLevel: number): boolean {
  return actor.isAdmin || actor.roleLevel > targetLevel;
}

/** Can `actor` assign, create or edit a role at `roleLevel`? */
export function canAssignRoleLevel(actor: LevelActor, roleLevel: number): boolean {
  return actor.isAdmin || actor.roleLevel > roleLevel;
}

/** Highest level `actor` may give a role (Super Admin's 100 is reserved). */
export function maxAssignableLevel(actor: LevelActor, customMax: number): number {
  return actor.isAdmin ? customMax : Math.min(customMax, actor.roleLevel - 1);
}
