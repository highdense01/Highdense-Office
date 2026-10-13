import { listDesignations } from "@/server/actions/roles";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { DesignationsClient } from "./designations-client";

export default async function DesignationsPage() {
  const user = await requireAuth();
  const designations = await listDesignations();
  return <DesignationsClient designations={designations} canManage={hasPermission(user, PERMISSIONS.DESIGNATION_MANAGE)} />;
}
