"use client";

import { useCallback } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { getRoomMessages, sendRoomMessage, markRoomRead } from "@/server/actions/chat";
import type { Message, User } from "@prisma/client";

export function RoomChatClient({
  roomId,
  roomName,
  memberCount,
  currentUserId,
  initialMessages,
}: {
  roomId: string;
  roomName: string;
  memberCount: number;
  currentUserId: string;
  initialMessages: (Message & { sender: User })[];
}) {
  const fetchMessages = useCallback(() => getRoomMessages(roomId), [roomId]);
  const sendMessage = useCallback((content: string) => sendRoomMessage({ roomId, content }), [roomId]);
  const markRead = useCallback(() => markRoomRead(roomId), [roomId]);

  return (
    <ChatWindow
      title={roomName}
      subtitle={`${memberCount} members`}
      currentUserId={currentUserId}
      initialMessages={initialMessages}
      fetchMessages={fetchMessages}
      sendMessage={sendMessage}
      markRead={markRead}
    />
  );
}
