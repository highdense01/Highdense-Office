import { notFound } from "next/navigation";
import { getRoleById, listPermissions } from "@/server/actions/roles";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { canAssignRoleLevel } from "@/lib/permissions/hierarchy";
import { Badge } from "@/components/ui/badge";
import { PermissionsEditor } from "./permissions-editor";
import { RoleLevelEditor } from "./role-level-editor";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const [role, allPermissions] = await Promise.all([getRoleById(id), listPermissions()]);
  if (!role) notFound();

  const outranks = canAssignRoleLevel(user, role.level);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{role.name}</h1>
          <Badge variant="outline">Level {role.level}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {role.description || "No description"} · {role._count.users} employee(s) assigned
        </p>
      </div>
      {hasPermission(user, PERMISSIONS.ROLE_UPDATE) && !role.isSystem && outranks && (
        <RoleLevelEditor
          roleId={role.id}
          level={role.level}
          maxLevel={user.isAdmin ? 99 : Math.min(99, user.roleLevel - 1)}
        />
      )}
      {!outranks && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This role is at or above your own level, so you can view it but not change it.
        </p>
      )}
      <PermissionsEditor
        roleId={role.id}
        roleName={role.name}
        isSystem={role.isSystem}
        allPermissions={allPermissions}
        initialGranted={role.rolePermissions.map((rp) => rp.permission.key)}
        readOnly={!hasPermission(user, PERMISSIONS.PERMISSION_ASSIGN) || !outranks}
      />
    </div>
  );
}
