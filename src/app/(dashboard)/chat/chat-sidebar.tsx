"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus, Users, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateRoomDialog } from "./create-room-dialog";
import { Button } from "@/components/ui/button";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ChatSidebarProps {
  rooms: { id: string; name: string; messages: { content: string }[] }[];
  conversations: { id: string; otherUser: { id: string; name: string } | null; isOnline: boolean; messages: { content: string }[] }[];
  employees: { id: string; name: string; email: string }[];
  canManageRooms: boolean;
}

export function ChatSidebar({ rooms, conversations, employees, canManageRooms }: ChatSidebarProps) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col border-r sm:w-72">
      <Tabs defaultValue="direct" className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <TabsList>
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
          </TabsList>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-8" asChild>
              <Link href="/chat/direct/new">
                <MessageCircle className="size-4" />
              </Link>
            </Button>
            {canManageRooms && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="direct" className="flex-1 overflow-y-auto p-1">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/chat/direct/${c.id}`}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted ${
                  pathname === `/chat/direct/${c.id}` ? "bg-muted" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">{initialsOf(c.otherUser?.name ?? "?")}</AvatarFallback>
                  </Avatar>
                  {c.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.otherUser?.name ?? "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.messages[0]?.content ?? "No messages yet"}</p>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="rooms" className="flex-1 overflow-y-auto p-1">
          {rooms.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No rooms yet.</p>
          ) : (
            rooms.map((room) => (
              <Link
                key={room.id}
                href={`/chat/rooms/${room.id}`}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted ${
                  pathname === `/chat/rooms/${room.id}` ? "bg-muted" : ""
                }`}
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback>
                    <Users className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{room.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{room.messages[0]?.content ?? "No messages yet"}</p>
                </div>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>

      {canManageRooms && <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} employees={employees} />}
    </div>
  );
}
