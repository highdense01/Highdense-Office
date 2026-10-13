import { notFound } from "next/navigation";
import { getConversationWithUser, getConversationMessages } from "@/server/actions/chat";
import { requireAuth } from "@/lib/permissions/check";
import { DirectChatClient } from "./direct-chat-client";

export default async function DirectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const result = await getConversationWithUser(id);
  if (!result || !result.otherUser) notFound();

  const messages = await getConversationMessages(id);

  return (
    <DirectChatClient
      conversationId={id}
      otherUserName={result.otherUser.name}
      otherUserId={result.otherUser.id}
      currentUserId={user.id}
      initialMessages={messages}
    />
  );
}
