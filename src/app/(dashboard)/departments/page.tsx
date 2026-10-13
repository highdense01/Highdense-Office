import { listDepartments } from "@/server/actions/roles";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const user = await requireAuth();
  const departments = await listDepartments();
  return <DepartmentsClient departments={departments} canManage={hasPermission(user, PERMISSIONS.DEPARTMENT_MANAGE)} />;
}
