"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { requirePermission, requireAuth } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { createNotification } from "@/lib/notifications/create";
import { incrementUnreadCount, resetUnreadCount, getOnlineUserIds, markUserOnline } from "@/lib/redis/client";
import { checkRateLimit, chatMessageLimiter } from "@/lib/redis/rate-limit";
import {
  createChatRoomSchema,
  sendRoomMessageSchema,
  sendDirectMessageSchema,
  type CreateChatRoomInput,
  type SendRoomMessageInput,
  type SendDirectMessageInput,
} from "@/lib/validations/chat";
import type { ActionResult } from "./employees";

export async function createChatRoom(input: CreateChatRoomInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CHAT_MANAGE_ROOMS);

  const parsed = createChatRoomSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const data = parsed.data;

  const room = await prisma.chatRoom.create({
    data: {
      name: data.name,
      description: data.description || null,
      createdById: actor.id,
      members: {
        create: [...new Set([actor.id, ...data.memberIds])].map((userId) => ({
          userId,
          isAdmin: userId === actor.id,
        })),
      },
    },
    select: { id: true },
  });

  await logActivity({
    userId: actor.id,
    action: "chat_room.created",
    entityType: "ChatRoom",
    entityId: room.id,
    description: `${actor.name ?? actor.email} created chat room "${data.name}"`,
  });

  revalidatePath("/chat");
  return { success: true, data: { id: room.id } };
}

export async function addChatRoomMembers(roomId: string, userIds: string[]): Promise<ActionResult> {
  const actor = await requirePermission(PERMISSIONS.CHAT_MANAGE_ROOMS);

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return { success: false, error: "Room not found." };

  await prisma.chatRoomMember.createMany({
    data: userIds.map((userId) => ({ roomId, userId })),
    skipDuplicates: true,
  });

  await logActivity({
    userId: actor.id,
    action: "chat_room.members_added",
    entityType: "ChatRoom",
    entityId: roomId,
    description: `${actor.name ?? actor.email} added members to "${room.name}"`,
  });

  revalidatePath(`/chat/rooms/${roomId}`);
  return { success: true, data: undefined };
}

export async function sendRoomMessage(input: SendRoomMessageInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CHAT_SEND);

  const { success } = await checkRateLimit(chatMessageLimiter, actor.id);
  if (!success) return { success: false, error: "You're sending messages too fast. Please slow down." };

  const parsed = sendRoomMessageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { roomId, content } = parsed.data;

  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: actor.id } },
  });
  if (!membership) return { success: false, error: "You are not a member of this room." };

  const message = await prisma.message.create({
    data: { roomId, senderId: actor.id, content },
    select: { id: true },
  });

  await markUserOnline(actor.id);

  const members = await prisma.chatRoomMember.findMany({
    where: { roomId, userId: { not: actor.id } },
    select: { userId: true },
  });
  await Promise.all(members.map((m) => incrementUnreadCount(m.userId, `room:${roomId}`)));

  revalidatePath(`/chat/rooms/${roomId}`);
  return { success: true, data: { id: message.id } };
}

export async function markRoomRead(roomId: string): Promise<ActionResult> {
  const actor = await requireAuth();
  await resetUnreadCount(actor.id, `room:${roomId}`);
  return { success: true, data: undefined };
}

async function getOrCreateConversation(userIdA: string, userIdB: string) {
  const [participantOneId, participantTwoId] = [userIdA, userIdB].sort();
  return prisma.conversation.upsert({
    where: { participantOneId_participantTwoId: { participantOneId, participantTwoId } },
    update: {},
    create: { participantOneId, participantTwoId },
  });
}

export async function sendDirectMessage(input: SendDirectMessageInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CHAT_SEND);

  const { success } = await checkRateLimit(chatMessageLimiter, actor.id);
  if (!success) return { success: false, error: "You're sending messages too fast. Please slow down." };

  const parsed = sendDirectMessageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { recipientId, content } = parsed.data;

  if (recipientId === actor.id) return { success: false, error: "You cannot message yourself." };

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.deletedAt) return { success: false, error: "Recipient not found." };

  const conversation = await getOrCreateConversation(actor.id, recipientId);

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: actor.id, content },
    select: { id: true },
  });

  await markUserOnline(actor.id);
  await incrementUnreadCount(recipientId, `conversation:${conversation.id}`);

  await createNotification({
    userId: recipientId,
    type: "NEW_MESSAGE",
    title: `New message from ${actor.name ?? actor.email}`,
    message: content.slice(0, 140),
    entityType: "Conversation",
    entityId: conversation.id,
  });

  revalidatePath(`/chat/direct/${conversation.id}`);
  return { success: true, data: { id: message.id } };
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const actor = await requireAuth();
  await resetUnreadCount(actor.id, `conversation:${conversationId}`);
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: actor.id }, readAt: null },
    data: { readAt: new Date() },
  });
  return { success: true, data: undefined };
}

export async function listMyChatRooms() {
  const actor = await requireAuth();
  return prisma.chatRoom.findMany({
    where: { isActive: true, members: { some: { userId: actor.id } } },
    include: {
      _count: { select: { members: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listMyConversations() {
  const actor = await requireAuth();
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ participantOneId: actor.id }, { participantTwoId: actor.id }] },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const otherUserIds = conversations.map((c) =>
    c.participantOneId === actor.id ? c.participantTwoId : c.participantOneId,
  );
  const [users, onlineIds] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: otherUserIds } } }),
    getOnlineUserIds(otherUserIds),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  return conversations.map((c) => {
    const otherUserId = c.participantOneId === actor.id ? c.participantTwoId : c.participantOneId;
    return {
      ...c,
      otherUser: userById.get(otherUserId) ?? null,
      isOnline: onlineIds.has(otherUserId),
    };
  });
}

export async function listChatableUsers() {
  const actor = await requireAuth();
  return prisma.user.findMany({
    where: { deletedAt: null, accountStatus: "ACTIVE", id: { not: actor.id } },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });
}

export async function getChatRoom(roomId: string) {
  const actor = await requireAuth();
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { members: { include: { user: true } } },
  });
  if (!room || !room.members.some((m) => m.userId === actor.id)) return null;
  return room;
}

export async function getConversationWithUser(conversationId: string) {
  const actor = await requireAuth();
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.participantOneId !== actor.id && conversation.participantTwoId !== actor.id)) {
    return null;
  }
  const otherUserId = conversation.participantOneId === actor.id ? conversation.participantTwoId : conversation.participantOneId;
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  return { conversation, otherUser };
}

export async function startDirectConversation(recipientId: string) {
  const actor = await requireAuth();
  const conversation = await getOrCreateConversation(actor.id, recipientId);
  return conversation.id;
}

export async function getRoomMessages(roomId: string) {
  await requireAuth();
  return prisma.message.findMany({
    where: { roomId, deletedAt: null },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function getConversationMessages(conversationId: string) {
  await requireAuth();
  return prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}
