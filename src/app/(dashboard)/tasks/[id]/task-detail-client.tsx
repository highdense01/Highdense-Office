"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateTaskProgress, addTaskComment } from "@/server/actions/tasks";
import type { Task, TaskComment, TaskProgressUpdate, User } from "@prisma/client";

interface TaskDetailClientProps {
  task: Task;
  comments: (TaskComment & { user: User })[];
  progressUpdates: (TaskProgressUpdate & { user: User })[];
  canUpdateProgress: boolean;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TaskDetailClient({ task, comments, progressUpdates, canUpdateProgress }: TaskDetailClientProps) {
  const [progress, setProgress] = useState(task.progress);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const router = useRouter();

  async function handleProgressSave() {
    setSavingProgress(true);
    const result = await updateTaskProgress({ taskId: task.id, progress, note });
    setSavingProgress(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Progress updated");
    setNote("");
    router.refresh();
  }

  async function handleCommentSubmit() {
    if (!comment.trim()) return;
    setSavingComment(true);
    const result = await addTaskComment({ taskId: task.id, message: comment });
    setSavingComment(false);
    if (!result.success) return toast.error(result.error);
    setComment("");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {canUpdateProgress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Update Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Slider value={[progress]} onValueChange={([v]) => setProgress(v)} max={100} step={5} className="flex-1" />
                <span className="w-12 text-right text-sm font-medium tabular-nums">{progress}%</span>
              </div>
              <Textarea
                placeholder='Add a note, e.g. "Google OAuth implementation started."'
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <Button onClick={handleProgressSave} disabled={savingProgress}>
                {savingProgress ? "Saving..." : "Save Progress"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initialsOf(c.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 rounded-md bg-muted/50 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{c.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm">{c.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea placeholder="Write a comment..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            </div>
            <Button size="sm" onClick={handleCommentSubmit} disabled={savingComment || !comment.trim()}>
              {savingComment ? "Posting..." : "Post Comment"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Progress History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progressUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No progress updates yet.</p>
          ) : (
            progressUpdates.map((update) => (
              <div key={update.id} className="border-b pb-2.5 text-sm last:border-0 last:pb-0">
                <p className="font-medium">
                  {update.previousProgress}% → {update.newProgress}%
                </p>
                {update.note && <p className="text-muted-foreground">{update.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {update.user.name} · {formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
