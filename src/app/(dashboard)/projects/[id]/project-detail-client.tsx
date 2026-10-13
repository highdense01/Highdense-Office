"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskProgressRow } from "@/components/tasks/task-progress-row";
import type { Project, Task, User } from "@prisma/client";

interface ProjectDetailClientProps {
  project: Project;
  tasks: (Task & { assignedTo: User | null })[];
  assignees: User[];
  canCreateTask: boolean;
}

export function ProjectDetailClient({ project, tasks, assignees, canCreateTask }: ProjectDetailClientProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Tasks ({tasks.length})</h2>
        {canCreateTask && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add Task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-md border py-10 text-center text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskProgressRow
              key={task.id}
              id={task.id}
              title={task.title}
              projectName={task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}
              status={task.status}
              priority={task.priority}
              progress={task.progress}
              dueDate={task.dueDate}
            />
          ))}
        </div>
      )}

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        projects={[project]}
        assignees={assignees}
        defaultProjectId={project.id}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
