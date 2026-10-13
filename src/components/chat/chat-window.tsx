"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message, User } from "@prisma/client";

type MessageWithSender = Message & { sender: User };

interface ChatWindowProps {
  title: string;
  subtitle?: string;
  currentUserId: string;
  initialMessages: MessageWithSender[];
  fetchMessages: () => Promise<MessageWithSender[]>;
  sendMessage: (content: string) => Promise<{ success: boolean; error?: string }>;
  markRead: () => Promise<unknown>;
}

const POLL_INTERVAL_MS = 4000;

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ChatWindow({ title, subtitle, currentUserId, initialMessages, fetchMessages, sendMessage, markRead }: ChatWindowProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead();
  }, [markRead]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const latest = await fetchMessages();
      setMessages(latest);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    startTransition(async () => {
      const result = await sendMessage(content);
      if (result.success) {
        const latest = await fetchMessages();
        setMessages(latest);
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <ScrollArea className="flex-1 px-4 py-3" viewportRef={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === currentUserId;
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  {!isMine && (
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initialsOf(message.sender.name)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!isMine && <p className="mb-0.5 text-xs font-medium opacity-70">{message.sender.name}</p>}
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`mt-1 text-[10px] ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          rows={1}
          className="min-h-9 flex-1 resize-none"
        />
        <Button size="icon" onClick={handleSend} disabled={isPending || !draft.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
