"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/permissions/check";
import { createTodoSchema, updateTodoSchema, type CreateTodoInput, type UpdateTodoInput } from "@/lib/validations/todo";
import type { ActionResult } from "./employees";

export async function createTodo(input: CreateTodoInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requireAuth();

  const parsed = createTodoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const todo = await prisma.todo.create({
    data: {
      userId: actor.id,
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      dueDate: data.dueDate ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/todos");
  return { success: true, data: { id: todo.id } };
}

export async function updateTodo(input: UpdateTodoInput): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = updateTodoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { id, ...data } = parsed.data;

  const existing = await prisma.todo.findUnique({ where: { id } });
  if (!existing || existing.userId !== actor.id) return { success: false, error: "Todo not found." };

  const isCompleting = data.status === "COMPLETED" && existing.status !== "COMPLETED";

  await prisma.todo.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.status !== undefined && { status: data.status }),
      ...(isCompleting && { completedAt: new Date() }),
    },
  });

  revalidatePath("/todos");
  return { success: true, data: undefined };
}

export async function completeTodo(id: string): Promise<ActionResult> {
  return updateTodo({ id, status: "COMPLETED" });
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  const actor = await requireAuth();
  const existing = await prisma.todo.findUnique({ where: { id } });
  if (!existing || existing.userId !== actor.id) return { success: false, error: "Todo not found." };

  await prisma.todo.delete({ where: { id } });

  revalidatePath("/todos");
  return { success: true, data: undefined };
}

export async function listMyTodos() {
  const actor = await requireAuth();
  return prisma.todo.findMany({
    where: { userId: actor.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}
