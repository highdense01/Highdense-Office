import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <MessageSquare className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Select a conversation or room to start chatting.</p>
    </div>
  );
}
