import { notFound } from "next/navigation";
import { getTaskDetail } from "@/server/actions/tasks";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { TaskDetailClient } from "./task-detail-client";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const task = await getTaskDetail(id);
  if (!task) notFound();

  const canUpdateProgress = task.assignedToId === user.id || hasPermission(user, PERMISSIONS.TASK_UPDATE);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{task.title}</h1>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.project && <span>Project: {task.project.name}</span>}
          <span>Assigned to: {task.assignedTo?.name ?? "Unassigned"}</span>
          <span>Assigned by: {task.assignedBy.name}</span>
          {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>

      <TaskDetailClient
        task={task}
        comments={task.comments}
        progressUpdates={task.progressUpdates}
        canUpdateProgress={canUpdateProgress}
      />
    </div>
  );
}
