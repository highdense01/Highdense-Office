import { z } from "zod";

export const createChatRoomSchema = z.object({
  name: z.string().trim().min(2, "Room name is required").max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  memberIds: z.array(z.string()).default([]),
});
export type CreateChatRoomInput = z.infer<typeof createChatRoomSchema>;

export const sendRoomMessageSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().trim().min(1, "Message cannot be empty").max(4000),
});
export type SendRoomMessageInput = z.infer<typeof sendRoomMessageSchema>;

export const sendDirectMessageSchema = z.object({
  recipientId: z.string().min(1),
  content: z.string().trim().min(1, "Message cannot be empty").max(4000),
});
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;
