"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/task";
import { createTask } from "@/server/actions/tasks";
import type { Project, User } from "@prisma/client";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  assignees: User[];
  defaultProjectId?: string;
  onSaved: () => void;
}

export function TaskFormDialog({ open, onOpenChange, projects, assignees, defaultProjectId, onSaved }: TaskFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { status: "TODO", priority: "MEDIUM", projectId: defaultProjectId },
  });

  useEffect(() => {
    if (open) reset({ status: "TODO", priority: "MEDIUM", projectId: defaultProjectId });
  }, [open, defaultProjectId, reset]);

  async function onSubmit(values: CreateTaskInput) {
    setSubmitting(true);
    const result = await createTask(values);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Task created");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input id="task-title" placeholder="Implement authentication" {...register("title")} />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-description">Description</FieldLabel>
              <Textarea id="task-description" rows={3} {...register("description")} />
            </Field>
            {!defaultProjectId && (
              <Field>
                <FieldLabel>Project</FieldLabel>
                <Controller
                  control={control}
                  name="projectId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No project (standalone task)" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Assign To</FieldLabel>
                <Controller
                  control={control}
                  name="assignedToId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignees.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="start-date">Start Date</FieldLabel>
                <Input id="start-date" type="date" {...register("startDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="due-date">Due Date</FieldLabel>
                <Input id="due-date" type="date" {...register("dueDate")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="estimated-hours">Estimated Hours</FieldLabel>
              <Input id="estimated-hours" type="number" min={0} step={0.5} {...register("estimatedHours")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
