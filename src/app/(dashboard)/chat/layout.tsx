import { listMyChatRooms, listMyConversations, listChatableUsers } from "@/server/actions/chat";
import { hasPermission, requireAuth } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { ChatSidebar } from "./chat-sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const [rooms, conversations, employees] = await Promise.all([
    listMyChatRooms(),
    listMyConversations(),
    listChatableUsers(),
  ]);

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border">
      <ChatSidebar
        rooms={rooms}
        conversations={conversations}
        employees={employees}
        canManageRooms={hasPermission(user, PERMISSIONS.CHAT_MANAGE_ROOMS)}
      />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
