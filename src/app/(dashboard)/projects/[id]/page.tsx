import { notFound } from "next/navigation";
import { getProjectDetail } from "@/server/actions/projects";
import { listPinnedProjectIds } from "@/server/actions/project-hub";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PinButton } from "@/components/projects/pin-button";
import { ProjectDetailClient } from "./project-detail-client";
import { ProjectTechPanel } from "./project-tech-panel";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const [project, employees, pinnedIds] = await Promise.all([
    getProjectDetail(id),
    prisma.user.findMany({ where: { deletedAt: null, accountStatus: "ACTIVE" }, orderBy: { name: "asc" } }),
    listPinnedProjectIds(),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          <PinButton projectId={project.id} pinned={pinnedIds.includes(project.id)} className="ml-auto" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">Progress</p>
            <div className="flex items-center gap-2">
              <Progress value={project.progress} className="h-2" />
              <span className="text-sm font-medium tabular-nums">{project.progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {project.startDate ? new Date(project.startDate).toLocaleDateString() : "No start date"} —{" "}
              {project.endDate ? new Date(project.endDate).toLocaleDateString() : "No end date"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">Manager</p>
            <p className="text-sm text-muted-foreground">{project.manager?.name ?? "Unassigned"}</p>
            <p className="text-xs text-muted-foreground">Created by {project.createdBy.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">Team ({project.members.length})</p>
            <div className="flex flex-wrap gap-1">
              {project.members.map((m) => (
                <Avatar key={m.id} className="size-7" title={m.user.name}>
                  <AvatarFallback className="text-[10px]">
                    {m.user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ProjectDetailClient
        project={project}
        tasks={project.tasks}
        assignees={employees}
        canCreateTask={hasPermission(user, PERMISSIONS.TASK_CREATE)}
      />

      <ProjectTechPanel
        projectId={project.id}
        tech={project.techStack}
        canEdit={hasPermission(user, PERMISSIONS.PROJECT_UPDATE)}
      />
    </div>
  );
}
