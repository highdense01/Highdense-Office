import { listRoles } from "@/server/actions/roles";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { RoleListClient } from "./role-list-client";

export default async function RolesPage() {
  const user = await requireAuth();
  const roles = await listRoles();

  return (
    <RoleListClient
      roles={roles}
      canCreate={hasPermission(user, PERMISSIONS.ROLE_CREATE)}
      actor={{ isAdmin: user.isAdmin, roleLevel: user.roleLevel }}
    />
  );
}
