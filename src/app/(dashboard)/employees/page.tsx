import { listEmployees } from "@/server/actions/employees";
import { listDepartments, listDesignations, listRoles } from "@/server/actions/roles";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAssignRoleLevel } from "@/lib/permissions/hierarchy";
import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const user = await requireAuth();
  const [employees, departments, designations, roles] = await Promise.all([
    listEmployees(),
    listDepartments(),
    listDesignations(),
    listRoles(),
  ]);

  return (
    <EmployeesClient
      employees={employees}
      departments={departments}
      designations={designations}
      // Hierarchy: only roles below the viewer's own level can be assigned.
      roles={roles.filter((r) => r.isActive && canAssignRoleLevel(user, r.level))}
      canCreate={hasPermission(user, PERMISSIONS.USER_CREATE)}
      canEdit={hasPermission(user, PERMISSIONS.USER_UPDATE)}
      canDeactivate={hasPermission(user, PERMISSIONS.USER_DELETE)}
      canImpersonate={user.isAdmin && !user.isImpersonating}
      currentUserId={user.id}
      actor={{ isAdmin: user.isAdmin, roleLevel: user.roleLevel }}
    />
  );
}
