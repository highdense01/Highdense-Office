"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRoleSchema, type CreateRoleInput } from "@/lib/validations/role";
import { MAX_CUSTOM_ROLE_LEVEL } from "@/lib/permissions/constants";
import { canAssignRoleLevel, maxAssignableLevel } from "@/lib/permissions/hierarchy";
import { createRole } from "@/server/actions/roles";
import type { Role, RolePermission, Permission } from "@prisma/client";

type RoleRow = Role & { rolePermissions: (RolePermission & { permission: Permission })[]; _count: { users: number } };

export function RoleListClient({
  roles,
  canCreate,
  actor,
}: {
  roles: RoleRow[];
  canCreate: boolean;
  actor: { isAdmin: boolean; roleLevel: number };
}) {
  const maxLevel = maxAssignableLevel(actor, MAX_CUSTOM_ROLE_LEVEL);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createRoleSchema), defaultValues: { isActive: true, level: Math.max(0, Math.min(10, maxLevel)) } });

  async function onSubmit(values: CreateRoleInput) {
    setSubmitting(true);
    const result = await createRole(values);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Role created");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Roles are ranked by level — higher means more authority. You can only manage roles and employees below
            your own level.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Create Role
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Link key={role.id} href={`/roles/${role.id}`}>
            <Card
              className={`h-full transition-colors hover:bg-muted/40 ${
                canAssignRoleLevel(actor, role.level) ? "" : "opacity-70"
              }`}
            >
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <span className="font-medium">{role.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {role.isSystem && <Badge variant="secondary">System</Badge>}
                    <Badge variant="outline" title="Hierarchy level">
                      Level {role.level}
                    </Badge>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{role.description || "No description"}</p>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>{role.rolePermissions.length} permissions</span>
                  <span>{role._count.users} employees</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="role-name">Role Name</FieldLabel>
                <Input id="role-name" placeholder="Senior Developer" {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.level}>
                <FieldLabel htmlFor="role-level">Level (0–{maxLevel})</FieldLabel>
                <Input
                  id="role-level"
                  type="number"
                  min={0}
                  max={maxLevel}
                  {...register("level", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Higher level = more authority. People can only manage roles and employees below their own level.
                </p>
                <FieldError errors={[errors.level]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="role-description">Description</FieldLabel>
                <Textarea id="role-description" rows={3} placeholder="Senior software development employee" {...register("description")} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
