"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { Project, Task, User } from "@prisma/client";

type TaskRow = Task & { project: Pick<Project, "id" | "name"> | null; assignedTo: User | null; assignedBy: User };

export function TasksClient({
  tasks,
  projects,
  assignees,
  canCreate,
}: {
  tasks: TaskRow[];
  projects: Project[];
  assignees: User[];
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const columns: ColumnDef<TaskRow>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => (
        <Link href={`/tasks/${row.original.id}`} className="hover:underline">
          <p className="font-medium">{row.original.title}</p>
          {row.original.project && <p className="text-xs text-muted-foreground">{row.original.project.name}</p>}
        </Link>
      ),
    },
    {
      id: "assignedTo",
      header: "Assignee",
      accessorFn: (row) => row.assignedTo?.name ?? "Unassigned",
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "progress",
      header: "Progress",
      cell: ({ row }) => (
        <div className="flex w-32 items-center gap-2">
          <Progress value={row.original.progress} className="h-1.5" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums">{row.original.progress}%</span>
        </div>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: ({ row }) => (row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} tasks</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Create Task
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={tasks} searchKey="title" searchPlaceholder="Search tasks..." emptyMessage="No tasks assigned yet." />

      <TaskFormDialog open={open} onOpenChange={setOpen} projects={projects} assignees={assignees} onSaved={() => router.refresh()} />
    </div>
  );
}
