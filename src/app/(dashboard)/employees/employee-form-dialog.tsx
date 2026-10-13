"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { createEmployeeSchema, type CreateEmployeeInput } from "@/lib/validations/employee";
import { createEmployee, updateEmployee } from "@/server/actions/employees";
import { setEmployeePassword } from "@/server/actions/auth";
import type { Department, Designation, Role, User, UserRole } from "@prisma/client";

export interface EmployeeRow extends User {
  department: Department | null;
  designation: Designation | null;
  role: Role | null;
  manager: User | null;
  /** Extra roles on top of the primary `role`. */
  userRoles?: (UserRole & { role: Role })[];
}

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRow | null;
  departments: Department[];
  designations: Designation[];
  roles: Role[];
  managers: { id: string; name: string }[];
  onSaved: () => void;
}

export function EmployeeFormDialog({ open, onOpenChange, employee, ...formProps }: EmployeeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Update this employee's details."
              : "Create a new employee record. They can sign in with this email once active."}
          </DialogDescription>
        </DialogHeader>
        {/* Keying on open+employee forces a fresh mount (fresh form state, fresh password
            field) each time the dialog opens, instead of resetting via an effect. */}
        <EmployeeFormBody
          key={open ? (employee?.id ?? "create") : "closed"}
          employee={employee}
          onOpenChange={onOpenChange}
          {...formProps}
        />
      </DialogContent>
    </Dialog>
  );
}

function EmployeeFormBody({
  employee,
  departments,
  designations,
  roles,
  managers,
  onSaved,
  onOpenChange,
}: Omit<EmployeeFormDialogProps, "open">) {
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const isEdit = !!employee;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: employee
      ? {
          employeeId: employee.employeeId ?? "",
          name: employee.name,
          email: employee.email,
          phone: employee.phone ?? "",
          departmentId: employee.departmentId,
          designationId: employee.designationId,
          roleId: employee.roleId ?? "",
          additionalRoleIds: (employee.userRoles ?? []).map((ur) => ur.roleId),
          managerId: employee.managerId,
          joiningDate: employee.joiningDate ?? undefined,
          employmentStatus: employee.employmentStatus,
          accountStatus: employee.accountStatus,
          notes: employee.notes ?? "",
        }
      : { employmentStatus: "ACTIVE", accountStatus: "ACTIVE", additionalRoleIds: [] },
  });
  const primaryRoleId = useWatch({ control, name: "roleId" });
  // Roles that can be granted on top of the primary one: never system roles, never the primary itself.
  const extraRoleOptions = roles.filter((r) => !r.isSystem && r.id !== primaryRoleId);

  async function onSubmit(values: CreateEmployeeInput) {
    if (!isEdit && !password) {
      toast.error("Set a login password for the new employee.");
      return;
    }
    if (password && password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    const result = isEdit ? await updateEmployee({ id: employee!.id, ...values }) : await createEmployee(values);

    if (!result.success) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    const userId = isEdit ? employee!.id : result.data!.id;
    if (password) {
      const passwordResult = await setEmployeePassword({ userId, password });
      if (!passwordResult.success) {
        setSubmitting(false);
        toast.error(`Employee saved, but setting the password failed: ${passwordResult.error}`);
        return;
      }
    }

    setSubmitting(false);
    toast.success(isEdit ? "Employee updated" : "Employee created");
    onOpenChange(false);
    onSaved();
  }

  return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.employeeId}>
                <FieldLabel htmlFor="employeeId">Employee ID</FieldLabel>
                <Input id="employeeId" placeholder="EMP001" {...register("employeeId")} />
                <FieldError errors={[errors.employeeId]} />
              </Field>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input id="name" placeholder="John Doe" {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" placeholder="john@company.com" {...register("email")} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" placeholder="+91XXXXXXXXXX" {...register("phone")} />
                <FieldError errors={[errors.phone]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Department</FieldLabel>
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Designation</FieldLabel>
                <Controller
                  control={control}
                  name="designationId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        {designations.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.roleId}>
                <FieldLabel>Role</FieldLabel>
                <Controller
                  control={control}
                  name="roleId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.roleId]} />
              </Field>
              <Field>
                <FieldLabel>Manager / Supervisor</FieldLabel>
                <Controller
                  control={control}
                  name="managerId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers
                          .filter((m) => m.id !== employee?.id)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            {extraRoleOptions.length > 0 && (
              <Field>
                <FieldLabel>Additional roles</FieldLabel>
                <Controller
                  control={control}
                  name="additionalRoleIds"
                  render={({ field }) => {
                    const selected = field.value ?? [];
                    return (
                      <div className="grid max-h-36 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                        {extraRoleOptions.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected.includes(r.id)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked ? [...selected, r.id] : selected.filter((id: string) => id !== r.id),
                                )
                              }
                            />
                            {r.name}
                            <span className="text-xs text-muted-foreground">L{r.level}</span>
                          </label>
                        ))}
                      </div>
                    );
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The employee signs in with the role above, and can switch to any of these from the user menu without
                  logging out. Only roles below your own level are listed.
                </p>
              </Field>
            )}

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="joiningDate">Joining Date</FieldLabel>
                <Input id="joiningDate" type="date" {...register("joiningDate")} />
              </Field>
              <Field>
                <FieldLabel>Employment Status</FieldLabel>
                <Controller
                  control={control}
                  name="employmentStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                        <SelectItem value="RESIGNED">Resigned</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Account Status</FieldLabel>
                <Controller
                  control={control}
                  name="accountStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="notes">Additional Information</FieldLabel>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">
                {isEdit ? "Reset Password (optional)" : "Set Login Password"}
              </FieldLabel>
              <PasswordInput
                id="password"
                placeholder={isEdit ? "Leave blank to keep current password" : "Required to let them sign in"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Employee"}
            </Button>
          </DialogFooter>
        </form>
  );
}
