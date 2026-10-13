import { notFound } from "next/navigation";
import { getChatRoom, getRoomMessages } from "@/server/actions/chat";
import { requireAuth } from "@/lib/permissions/check";
import { RoomChatClient } from "./room-chat-client";

export default async function RoomChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const room = await getChatRoom(id);
  if (!room) notFound();

  const messages = await getRoomMessages(id);

  return (
    <RoomChatClient
      roomId={id}
      roomName={room.name}
      memberCount={room.members.length}
      currentUserId={user.id}
      initialMessages={messages}
    />
  );
}
