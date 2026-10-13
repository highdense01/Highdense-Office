"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Pin, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { PinButton } from "@/components/projects/pin-button";
import { TechBadge } from "@/components/projects/tech-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { updatePinNote } from "@/server/actions/project-hub";
import type { TechCategory } from "@/lib/validations/project-tech";

interface PinRow {
  id: string;
  projectId: string;
  note: string | null;
  openTasks: number;
  overdueTasks: number;
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    progress: number;
    startDate: Date | null;
    endDate: Date | null;
    manager: { name: string } | null;
    techStack: { id: string; name: string; category: string; version: string | null }[];
    members: { id: string; user: { name: string } }[];
    _count: { tasks: number };
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

function NoteEditor({ projectId, note }: { projectId: string; note: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updatePinNote(projectId, value);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          autoFocus
          rows={2}
          maxLength={500}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Why is this pinned? Next step, link, reminder..."
          aria-label="Pin note"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setValue(note ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
    >
      <StickyNote className="mt-0.5 size-3.5 shrink-0" />
      <span>{note || "Add a note..."}</span>
    </button>
  );
}

export function PinnedClient({ pins }: { pins: PinRow[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pinned Projects</h1>
        <p className="text-sm text-muted-foreground">Your personal shortlist — details, stack and what&apos;s left, at a glance.</p>
      </div>

      {pins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Pin className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing pinned yet. Use the pin icon on a project to keep it here.</p>
            <Button size="sm" asChild>
              <Link href="/projects">Browse projects</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pins.map(({ id, projectId, note, openTasks, overdueTasks, project }) => (
            <Card key={id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                      {project.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge status={project.status} />
                      <PriorityBadge priority={project.priority} />
                    </div>
                  </div>
                  <PinButton projectId={projectId} pinned />
                </div>

                <p className="line-clamp-3 text-sm text-muted-foreground">{project.description || "No description"}</p>

                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5" />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {project.progress}%
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {openTasks} open of {project._count.tasks} tasks
                  </span>
                  {overdueTasks > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertTriangle className="size-3.5" />
                      {overdueTasks} overdue
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {project.endDate ? `Due ${new Date(project.endDate).toLocaleDateString()}` : "No end date"}
                  </span>
                </div>

                {project.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.techStack.map((t) => (
                      <TechBadge key={t.id} name={t.name} category={t.category as TechCategory} version={t.version} />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex -space-x-1.5">
                    {project.members.slice(0, 5).map((m) => (
                      <Avatar key={m.id} className="size-6 border-2 border-background" title={m.user.name}>
                        <AvatarFallback className="text-[9px]">{initials(m.user.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {project.members.length > 5 && (
                      <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px]">
                        +{project.members.length - 5}
                      </span>
                    )}
                  </div>
                  {project.manager && <p className="text-xs text-muted-foreground">Manager: {project.manager.name}</p>}
                </div>

                <NoteEditor projectId={projectId} note={note} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
