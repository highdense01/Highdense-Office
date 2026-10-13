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
import { createDesignationSchema, type CreateDesignationInput } from "@/lib/validations/role";
import { createDesignation, updateDesignation } from "@/server/actions/roles";
import type { Designation } from "@prisma/client";

type DesignationRow = Designation & { _count: { users: number } };

export function DesignationsClient({ designations, canManage }: { designations: DesignationRow[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createDesignationSchema),
    defaultValues: { isActive: true },
  });

  async function onSubmit(values: CreateDesignationInput) {
    setSubmitting(true);
    const result = await createDesignation(values);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Designation created");
    setOpen(false);
    reset();
    router.refresh();
  }

  async function toggleActive(designation: DesignationRow) {
    const result = await updateDesignation({ id: designation.id, isActive: !designation.isActive });
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Designations</h1>
          <p className="text-sm text-muted-foreground">Manage job titles used across the organization.</p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add Designation
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
            {designations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No designations yet.
                </TableCell>
              </TableRow>
            ) : (
              designations.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell className="font-medium">{designation.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{designation.description || "—"}</TableCell>
                  <TableCell>{designation._count.users}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Switch checked={designation.isActive} onCheckedChange={() => toggleActive(designation)} />
                    ) : (
                      <Badge variant={designation.isActive ? "default" : "secondary"}>
                        {designation.isActive ? "Active" : "Inactive"}
                      </Badge>
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
            <DialogTitle>Add Designation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="designation-name">Name</FieldLabel>
                <Input id="designation-name" placeholder="Senior Developer" {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="designation-description">Description</FieldLabel>
                <Textarea id="designation-description" rows={3} {...register("description")} />
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
