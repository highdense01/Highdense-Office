"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { buildEmployeeColumns } from "./columns";
import { EmployeeFormDialog, type EmployeeRow } from "./employee-form-dialog";
import { deactivateEmployee } from "@/server/actions/employees";
import { canManageLevel, employeeLevel } from "@/lib/permissions/hierarchy";
import { noteLocalRoleChange } from "@/components/auth/session-sync";
import type { Department, Designation, Role } from "@prisma/client";

interface EmployeesClientProps {
  employees: EmployeeRow[];
  departments: Department[];
  designations: Designation[];
  roles: Role[];
  canCreate: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canImpersonate: boolean;
  currentUserId: string;
  actor: { isAdmin: boolean; roleLevel: number };
}

export function EmployeesClient({
  employees,
  departments,
  designations,
  roles,
  canCreate,
  canEdit,
  canDeactivate,
  canImpersonate,
  currentUserId,
  actor,
}: EmployeesClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<EmployeeRow | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  // The employee's current role is always shown (so the select isn't blank), even if it's not assignable by the viewer;
  // the server still rejects any actual change to a role at or above the viewer's level.
  const roleOptions =
    editing?.role && !roles.some((r) => r.id === editing.role!.id) ? [...roles, editing.role] : roles;

  const managers = employees.map((e) => ({ id: e.id, name: e.name }));

  const columns = buildEmployeeColumns({
    canEdit,
    canDeactivate,
    canImpersonate,
    currentUserId,
    canManage: (employee) => employee.id === currentUserId || canManageLevel(actor, employeeLevel(employee)),
    onEdit: (employee) => {
      setEditing(employee);
      setDialogOpen(true);
    },
    onDeactivate: async (id) => {
      const result = await deactivateEmployee(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Employee deactivated");
      router.refresh();
    },
    onImpersonate: (employee) => setImpersonateTarget(employee),
  });

  async function confirmImpersonate() {
    if (!impersonateTarget) return;
    setImpersonating(true);
    noteLocalRoleChange(); // our own action, not an admin edit: no "access updated" toast
    await update({ impersonateUserId: impersonateTarget.id });
    setImpersonating(false);
    setImpersonateTarget(null);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} total employees</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={employees}
        searchKey="name"
        searchPlaceholder="Search by name..."
        emptyMessage="No employees yet."
      />

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        departments={departments}
        designations={designations}
        roles={roleOptions}
        managers={managers}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={!!impersonateTarget} onOpenChange={(open) => !open && setImpersonateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log in as {impersonateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll have full access to this account, exactly as {impersonateTarget?.name} would. This is
              recorded in the activity log. You can return to your own account at any time from the banner at the
              top of the screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={impersonating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImpersonate} disabled={impersonating}>
              {impersonating && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
