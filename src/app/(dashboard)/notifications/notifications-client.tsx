"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";
import type { Notification } from "@prisma/client";

function entityHref(notification: Notification): string {
  if (notification.entityType === "Task" && notification.entityId) return `/tasks/${notification.entityId}`;
  if (notification.entityType === "Meeting") return "/meetings";
  if (notification.entityType === "Conversation" && notification.entityId) return `/chat/direct/${notification.entityId}`;
  return "#";
}

export function NotificationsClient({ notifications: initial }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [, startTransition] = useTransition();

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    });
  }

  function handleClick(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{notifications.filter((n) => !n.isRead).length} unread</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          Mark all read
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {notifications.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={entityHref(n)}
                onClick={() => handleClick(n.id)}
                className={`block px-4 py-3 hover:bg-muted/50 ${n.isRead ? "" : "bg-primary/5"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
