import type { DefaultSession } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeId: string | null;
      roleId: string | null;
      roleName: string | null;
      roleLevel: number;
      /** The user's own assigned role, regardless of any role switch. */
      realRoleId: string | null;
      realRoleName: string | null;
      realRoleLevel: number;
      realIsAdmin: boolean;
      /** True while acting as a different (lower) role. */
      isActingAs: boolean;
      /** There is another role (assigned, or a lower one to preview) this user can switch to. */
      canSwitchRole: boolean;
      /** Every role the user holds (primary first), for display. */
      assignedRoleNames: string[];
      permissions: PermissionKey[];
      isAdmin: boolean;
      accountStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      departmentId: string | null;
      isImpersonating: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    employeeId: string | null;
    roleId: string | null;
    roleName: string | null;
    roleLevel?: number;
    realRoleId?: string | null;
    realRoleName?: string | null;
    realRoleLevel?: number;
    realIsAdmin?: boolean;
    canSwitchRole?: boolean;
    assignedRoleNames?: string[];
    /** Role being acted as (validated server-side on every refresh); null = own role. */
    actingRoleId?: string | null;
    /** Last real user activity (ms epoch); drives the idle timeout. */
    lastActivityAt?: number;
    permissions: PermissionKey[];
    isAdmin: boolean;
    accountStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    departmentId: string | null;
    permissionsSyncedAt: number;
    impersonatorId?: string | null;
  }
}
