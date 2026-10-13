"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateRole } from "@/server/actions/roles";

export function RoleLevelEditor({ roleId, level, maxLevel }: { roleId: string; level: number; maxLevel: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(level));
  const [saving, setSaving] = useState(false);
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= maxLevel;

  async function save() {
    setSaving(true);
    const result = await updateRole({ id: roleId, level: parsed });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Level updated");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-4">
        <div className="space-y-1.5">
          <label htmlFor="level" className="text-sm font-medium">
            Hierarchy level (0–{maxLevel})
          </label>
          <Input
            id="level"
            type="number"
            min={0}
            max={maxLevel}
            className="w-32"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving || !valid || parsed === level}>
          {saving ? "Saving..." : "Save level"}
        </Button>
        <p className="basis-full text-xs text-muted-foreground">
          People can only manage roles and employees below their own level.
        </p>
      </CardContent>
    </Card>
  );
}
