"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { createDepartmentSchema, type CreateDepartmentInput } from "@/lib/validations/role";
import { createDepartment, updateDepartment } from "@/server/actions/roles";
import type { Department } from "@prisma/client";

type DepartmentRow = Department & { _count: { users: number } };

export function DepartmentsClient({ departments, canManage }: { departments: DepartmentRow[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: { isActive: true },
  });

  async function onSubmit(values: CreateDepartmentInput) {
    setSubmitting(true);
    const result = await createDepartment(values);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Department created");
    setOpen(false);
    reset();
    router.refresh();
  }

  async function toggleActive(dept: DepartmentRow) {
    const result = await updateDepartment({ id: dept.id, isActive: !dept.isActive });
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Departments</h1>
          <p className="text-sm text-muted-foreground">Organize employees into departments.</p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add Department
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No departments yet.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{dept.description || "—"}</TableCell>
                  <TableCell>{dept._count.users}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Switch checked={dept.isActive} onCheckedChange={() => toggleActive(dept)} />
                    ) : (
                      <Badge variant={dept.isActive ? "default" : "secondary"}>{dept.isActive ? "Active" : "Inactive"}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="dept-name">Name</FieldLabel>
                <Input id="dept-name" placeholder="Development" {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dept-description">Description</FieldLabel>
                <Textarea id="dept-description" rows={3} {...register("description")} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
