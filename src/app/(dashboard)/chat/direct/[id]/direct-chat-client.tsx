"use client";

import { useCallback } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { getConversationMessages, sendDirectMessage, markConversationRead } from "@/server/actions/chat";
import type { Message, User } from "@prisma/client";

export function DirectChatClient({
  conversationId,
  otherUserName,
  otherUserId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  otherUserName: string;
  otherUserId: string;
  currentUserId: string;
  initialMessages: (Message & { sender: User })[];
}) {
  const fetchMessages = useCallback(() => getConversationMessages(conversationId), [conversationId]);
  const sendMessage = useCallback(
    (content: string) => sendDirectMessage({ recipientId: otherUserId, content }),
    [otherUserId],
  );
  const markRead = useCallback(() => markConversationRead(conversationId), [conversationId]);

  return (
    <ChatWindow
      title={otherUserName}
      currentUserId={currentUserId}
      initialMessages={initialMessages}
      fetchMessages={fetchMessages}
      sendMessage={sendMessage}
      markRead={markRead}
    />
  );
}
