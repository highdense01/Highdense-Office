import Link from "next/link";
import { AlertTriangle, FolderKanban, ListTodo, OctagonAlert, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatCard } from "./stat-card";
import { TasksByStatusChart } from "./tasks-by-status-chart";
import type { getTeamDashboardStats } from "@/server/services/dashboard";

export function TeamDashboard({ stats }: { stats: Awaited<ReturnType<typeof getTeamDashboardStats>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="My Projects" value={stats.projectCount} icon={FolderKanban} />
        <StatCard label="Open Tasks" value={stats.openTasks} icon={ListTodo} />
        <StatCard label="Overdue" value={stats.overdueTasks} icon={AlertTriangle} tone="danger" />
        <StatCard label="Blocked" value={stats.blockedTasks} icon={OctagonAlert} tone="warning" />
        <StatCard label="Team Members" value={stats.teamSize} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tasks by Status (my projects)</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByStatusChart data={stats.tasksByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Team Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.workload.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No open work assigned to your team.</p>
            ) : (
              <ul className="divide-y">
                {stats.workload.map((person) => (
                  <li key={person.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="truncate">{person.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {person.open} open
                      {person.overdue > 0 && (
                        <span className="text-red-600 dark:text-red-400"> · {person.overdue} overdue</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Projects Needing Attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.projectsNeedingAttention.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active projects. You only see projects you manage, created or belong to.
            </p>
          ) : (
            stats.projectsNeedingAttention.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {project.pastDeadline && (
                      <span className="text-xs text-red-600 dark:text-red-400">Past deadline</span>
                    )}
                    <PriorityBadge priority={project.priority} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5" />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {project.progress}%
                  </span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
