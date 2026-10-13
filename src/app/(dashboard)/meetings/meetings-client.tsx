"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Video, Users, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/tasks/status-badge";
import { MeetingFormDialog } from "./meeting-form-dialog";
import { cancelMeeting, createInstantMeeting, joinMeetingByCode } from "@/server/actions/meetings";
import type { Meeting, MeetingParticipant, Project, User } from "@prisma/client";

type MeetingRow = Meeting & {
  createdBy: User;
  project: Pick<Project, "id" | "name"> | null;
  participants: (MeetingParticipant & { user: User })[];
};

export function MeetingsClient({
  meetings,
  employees,
  canCreate,
  canDelete,
}: {
  meetings: MeetingRow[];
  employees: User[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"instant" | "join" | null>(null);
  const router = useRouter();

  async function handleInstant() {
    setBusy("instant");
    const result = await createInstantMeeting();
    if (!result.success) {
      setBusy(null);
      return toast.error(result.error);
    }
    router.push(`/meetings/room/${result.data.id}`);
  }

  async function handleJoinCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy("join");
    const result = await joinMeetingByCode(code);
    if (!result.success) {
      setBusy(null);
      return toast.error(result.error);
    }
    router.push(`/meetings/room/${result.data.id}`);
  }

  const { today, upcoming, past } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(24, 0, 0, 0);

    return {
      today: meetings.filter((m) => new Date(m.date) >= startOfToday && new Date(m.date) < endOfToday),
      upcoming: meetings.filter((m) => new Date(m.date) >= endOfToday),
      past: meetings.filter((m) => new Date(m.date) < startOfToday),
    };
  }, [meetings]);

  async function handleCancel(id: string) {
    const result = await cancelMeeting(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Meeting cancelled");
    router.refresh();
  }

  function renderList(list: MeetingRow[]) {
    if (list.length === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">No meetings here.</p>;
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((meeting) => (
          <Card key={meeting.id}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{meeting.title}</p>
                <StatusBadge status={meeting.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(meeting.date).toLocaleDateString()} ·{" "}
                {new Date(meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                {new Date(meeting.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                {meeting.participants.length} participant(s)
              </div>
              <div className="flex items-center gap-2 pt-1">
                {meeting.status !== "CANCELLED" && meeting.status !== "COMPLETED" && (
                  <Button size="sm" asChild>
                    <Link href={`/meetings/room/${meeting.id}`}>
                      <Video className="size-3.5" />
                      {meeting.status === "LIVE" ? "Join now" : "Join Meeting"}
                    </Link>
                  </Button>
                )}
                {canDelete && meeting.status === "SCHEDULED" && (
                  <Button size="sm" variant="outline" onClick={() => handleCancel(meeting.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground">{meetings.length} meetings</p>
        </div>
        {canCreate && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Schedule Meeting
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          {canCreate && (
            <Button onClick={handleInstant} disabled={busy !== null}>
              <Video className="size-4" />
              {busy === "instant" ? "Starting..." : "New meeting"}
            </Button>
          )}
          <form onSubmit={handleJoinCode} className="flex flex-1 gap-2 sm:max-w-sm">
            <div className="relative flex-1">
              <Keyboard className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8 font-mono"
                placeholder="Enter a code (abc-defg-hij)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Meeting code"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy !== null || !code.trim()}>
              {busy === "join" ? "Joining..." : "Join"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">{renderList(today)}</TabsContent>
        <TabsContent value="upcoming">{renderList(upcoming)}</TabsContent>
        <TabsContent value="past">{renderList(past)}</TabsContent>
      </Tabs>

      <MeetingFormDialog open={open} onOpenChange={setOpen} employees={employees} onSaved={() => router.refresh()} />
    </div>
  );
}
