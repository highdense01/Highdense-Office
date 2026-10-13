/**
 * Canonical permission keys. This is the single source of truth for what
 * permissions exist in the system — the `permissions` table is seeded from
 * this list (see prisma/seed.ts). New permissions must be added here first.
 */
export const PERMISSIONS = {
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  ROLE_VIEW: "role.view",
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",

  PERMISSION_VIEW: "permission.view",
  PERMISSION_ASSIGN: "permission.assign",

  DEPARTMENT_VIEW: "department.view",
  DEPARTMENT_MANAGE: "department.manage",

  DESIGNATION_VIEW: "designation.view",
  DESIGNATION_MANAGE: "designation.manage",

  PROJECT_VIEW: "project.view",
  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",

  TASK_VIEW: "task.view",
  TASK_CREATE: "task.create",
  TASK_ASSIGN: "task.assign",
  TASK_UPDATE: "task.update",
  TASK_DELETE: "task.delete",
  TASK_COMPLETE: "task.complete",

  TODO_MANAGE_SELF: "todo.manage_self",

  CHAT_VIEW: "chat.view",
  CHAT_SEND: "chat.send",
  CHAT_MANAGE_ROOMS: "chat.manage_rooms",

  MEETING_VIEW: "meeting.view",
  MEETING_CREATE: "meeting.create",
  MEETING_UPDATE: "meeting.update",
  MEETING_DELETE: "meeting.delete",

  ACTIVITY_VIEW: "activity.view",

  REPORT_VIEW: "report.view",

  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_MODULES: Record<PermissionKey, string> = {
  [PERMISSIONS.USER_VIEW]: "user",
  [PERMISSIONS.USER_CREATE]: "user",
  [PERMISSIONS.USER_UPDATE]: "user",
  [PERMISSIONS.USER_DELETE]: "user",
  [PERMISSIONS.ROLE_VIEW]: "role",
  [PERMISSIONS.ROLE_CREATE]: "role",
  [PERMISSIONS.ROLE_UPDATE]: "role",
  [PERMISSIONS.ROLE_DELETE]: "role",
  [PERMISSIONS.PERMISSION_VIEW]: "permission",
  [PERMISSIONS.PERMISSION_ASSIGN]: "permission",
  [PERMISSIONS.DEPARTMENT_VIEW]: "department",
  [PERMISSIONS.DEPARTMENT_MANAGE]: "department",
  [PERMISSIONS.DESIGNATION_VIEW]: "designation",
  [PERMISSIONS.DESIGNATION_MANAGE]: "designation",
  [PERMISSIONS.PROJECT_VIEW]: "project",
  [PERMISSIONS.PROJECT_CREATE]: "project",
  [PERMISSIONS.PROJECT_UPDATE]: "project",
  [PERMISSIONS.PROJECT_DELETE]: "project",
  [PERMISSIONS.TASK_VIEW]: "task",
  [PERMISSIONS.TASK_CREATE]: "task",
  [PERMISSIONS.TASK_ASSIGN]: "task",
  [PERMISSIONS.TASK_UPDATE]: "task",
  [PERMISSIONS.TASK_DELETE]: "task",
  [PERMISSIONS.TASK_COMPLETE]: "task",
  [PERMISSIONS.TODO_MANAGE_SELF]: "todo",
  [PERMISSIONS.CHAT_VIEW]: "chat",
  [PERMISSIONS.CHAT_SEND]: "chat",
  [PERMISSIONS.CHAT_MANAGE_ROOMS]: "chat",
  [PERMISSIONS.MEETING_VIEW]: "meeting",
  [PERMISSIONS.MEETING_CREATE]: "meeting",
  [PERMISSIONS.MEETING_UPDATE]: "meeting",
  [PERMISSIONS.MEETING_DELETE]: "meeting",
  [PERMISSIONS.ACTIVITY_VIEW]: "activity",
  [PERMISSIONS.REPORT_VIEW]: "report",
  [PERMISSIONS.SETTINGS_MANAGE]: "settings",
};

/** Default permission sets for the seeded starter roles. Admins can change these later. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  "Super Admin": ALL_PERMISSION_KEYS,
  Admin: ALL_PERMISSION_KEYS.filter((p) => p !== PERMISSIONS.SETTINGS_MANAGE),
  Manager: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TODO_MANAGE_SELF,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.CHAT_MANAGE_ROOMS,
    PERMISSIONS.MEETING_VIEW,
    PERMISSIONS.MEETING_CREATE,
    PERMISSIONS.MEETING_UPDATE,
    PERMISSIONS.ACTIVITY_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  "Team Lead": [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TODO_MANAGE_SELF,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.MEETING_VIEW,
    PERMISSIONS.MEETING_CREATE,
    PERMISSIONS.ACTIVITY_VIEW,
  ],
  Employee: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TODO_MANAGE_SELF,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.MEETING_VIEW,
  ],
};

export const DEFAULT_ROLES = Object.keys(DEFAULT_ROLE_PERMISSIONS);

/**
 * Role hierarchy. A user may only manage employees, and create / edit / assign
 * roles, whose level is strictly BELOW their own. Level 100 is reserved for
 * Super Admin, so custom roles live in 0-99.
 */
export const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  "Super Admin": 100,
  Admin: 80,
  Manager: 60,
  "Team Lead": 40,
  Employee: 20,
};
export const MAX_CUSTOM_ROLE_LEVEL = 99;

/** Which dashboard a role sees after login, by hierarchy level (Super Admins always get the company view). */
export const DASHBOARD_MIN_LEVEL = { company: 80, team: 40 } as const;
