import { listChatableUsers } from "@/server/actions/chat";
import { NewDirectChatClient } from "./new-direct-chat-client";

export default async function NewDirectChatPage() {
  const employees = await listChatableUsers();
  return <NewDirectChatClient employees={employees} />;
}
