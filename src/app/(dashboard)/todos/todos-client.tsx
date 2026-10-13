"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { createTodoSchema, type CreateTodoInput } from "@/lib/validations/todo";
import { createTodo, completeTodo, deleteTodo, updateTodo } from "@/server/actions/todos";
import type { Todo } from "@prisma/client";

export function TodosClient({ todos }: { todos: Todo[] }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createTodoSchema), defaultValues: { priority: "MEDIUM" } });

  async function onSubmit(values: CreateTodoInput) {
    setSubmitting(true);
    const result = await createTodo(values);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Todo added");
    setOpen(false);
    reset();
    router.refresh();
  }

  async function handleComplete(id: string) {
    const result = await completeTodo(id);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const result = await deleteTodo(id);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  async function handleStatusChange(id: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED") {
    const result = await updateTodo({ id, status });
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  const pending = todos.filter((t) => t.status !== "COMPLETED");
  const completed = todos.filter((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Todos</h1>
          <p className="text-sm text-muted-foreground">Personal task list, separate from assigned work.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add Todo
        </Button>
      </div>

      <div className="space-y-2">
        {pending.length === 0 && completed.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">No todos yet. Add one to get started.</CardContent>
          </Card>
        ) : (
          [...pending, ...completed].map((todo) => (
            <Card key={todo.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <Checkbox checked={todo.status === "COMPLETED"} onCheckedChange={() => handleComplete(todo.id)} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${todo.status === "COMPLETED" ? "text-muted-foreground line-through" : ""}`}>
                    {todo.title}
                  </p>
                  {todo.description && <p className="truncate text-xs text-muted-foreground">{todo.description}</p>}
                </div>
                <PriorityBadge priority={todo.priority} />
                {todo.dueDate && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {new Date(todo.dueDate).toLocaleDateString()}
                  </span>
                )}
                {todo.status !== "COMPLETED" && (
                  <Select value={todo.status} onValueChange={(v) => handleStatusChange(todo.id, v as "PENDING" | "IN_PROGRESS")}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => handleDelete(todo.id)}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Todo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldGroup>
              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor="todo-title">Title</FieldLabel>
                <Input id="todo-title" placeholder="Write unit tests for auth flow" {...register("title")} />
                <FieldError errors={[errors.title]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="todo-description">Description</FieldLabel>
                <Textarea id="todo-description" rows={2} {...register("description")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
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
                <Field>
                  <FieldLabel htmlFor="todo-due">Due Date</FieldLabel>
                  <Input id="todo-due" type="date" {...register("dueDate")} />
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  "Adding..."
                ) : (
                  <>
                    <Check className="size-4" />
                    Add Todo
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
