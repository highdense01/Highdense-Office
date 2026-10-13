"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { PinButton } from "@/components/projects/pin-button";
import { ProjectFormDialog } from "./project-form-dialog";
import type { Project, User } from "@prisma/client";

type ProjectRow = Project & { manager: User | null; _count: { tasks: number; members: number } };

export function ProjectsClient({
  projects,
  employees,
  pinnedIds,
  canCreate,
}: {
  projects: ProjectRow[];
  employees: User[];
  pinnedIds: string[];
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Create Project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FolderKanban className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            {canCreate && (
              <Button size="sm" onClick={() => setOpen(true)}>
                Create your first project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="relative">
              <PinButton
                projectId={project.id}
                pinned={pinnedIds.includes(project.id)}
                className="absolute right-2 top-2 z-10"
              />
              <Link href={`/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{project.name}</p>
                    <span className="mr-7">
                      <PriorityBadge priority={project.priority} />
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.description || "No description"}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={project.progress} className="h-1.5" />
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <StatusBadge status={project.status} />
                    <span>
                      {project._count.tasks} tasks · {project._count.members} members
                    </span>
                  </div>
                  {project.manager && <p className="text-xs text-muted-foreground">Manager: {project.manager.name}</p>}
                </CardContent>
              </Card>
              </Link>
            </div>
          ))}
        </div>
      )}

      <ProjectFormDialog open={open} onOpenChange={setOpen} employees={employees} onSaved={() => router.refresh()} />
    </div>
  );
}
