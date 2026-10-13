"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assignRolePermissions } from "@/server/actions/roles";
import type { Permission } from "@prisma/client";

interface PermissionsEditorProps {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  allPermissions: Permission[];
  initialGranted: string[];
  readOnly: boolean;
}

function humanizeAction(key: string) {
  const action = key.split(".")[1] ?? key;
  return action
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function PermissionsEditor({
  roleId,
  roleName,
  isSystem,
  allPermissions,
  initialGranted,
  readOnly,
}: PermissionsEditorProps) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGranted));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of allPermissions) {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);

  function toggle(key: string) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const result = await assignRolePermissions({ roleId, permissionKeys: Array.from(granted) });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Permissions updated");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isSystem && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {roleName} is a system role with full access. Its permissions cannot be changed.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map(([module, permissions]) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="text-sm font-medium capitalize">{module}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={granted.has(permission.key)}
                    onCheckedChange={() => toggle(permission.key)}
                    disabled={readOnly || isSystem}
                  />
                  {humanizeAction(permission.key)}
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      {!readOnly && !isSystem && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Permissions"}
        </Button>
      )}
    </div>
  );
}
