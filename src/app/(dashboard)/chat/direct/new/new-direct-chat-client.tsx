"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { startDirectConversation } from "@/server/actions/chat";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NewDirectChatClient({ employees }: { employees: { id: string; name: string; email: string }[] }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = employees.filter(
    (e) => e.name.toLowerCase().includes(query.toLowerCase()) || e.email.toLowerCase().includes(query.toLowerCase()),
  );

  function handleSelect(userId: string) {
    startTransition(async () => {
      const conversationId = await startDirectConversation(userId);
      router.push(`/chat/direct/${conversationId}`);
    });
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees..." className="pl-8" />
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {filtered.map((employee) => (
          <button
            key={employee.id}
            disabled={isPending}
            onClick={() => handleSelect(employee.id)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initialsOf(employee.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{employee.name}</p>
              <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
