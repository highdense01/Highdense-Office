"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/permissions/check";
import type { ActionResult } from "./employees";

export async function listMyNotifications(limit = 20) {
  const actor = await requireAuth();
  return prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount() {
  const actor = await requireAuth();
  return prisma.notification.count({ where: { userId: actor.id, isRead: false } });
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const actor = await requireAuth();
  await prisma.notification.updateMany({ where: { id, userId: actor.id }, data: { isRead: true } });
  revalidatePath("/notifications");
  return { success: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const actor = await requireAuth();
  await prisma.notification.updateMany({ where: { userId: actor.id, isRead: false }, data: { isRead: true } });
  revalidatePath("/notifications");
  return { success: true, data: undefined };
}
