import Link from "next/link";
import { AlertTriangle, Hourglass } from "lucide-react";
import { getPendingProjects } from "@/server/actions/project-hub";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TaskProgressRow } from "@/components/tasks/task-progress-row";

export default async function PendingProjectsPage() {
  const projects = await getPendingProjects();

  const totals = projects.reduce(
    (acc, p) => ({
      open: acc.open + p.tasks.length,
      overdue: acc.overdue + p.overdueTasks,
      blocked: acc.blocked + p.blockedTasks,
      late: acc.late + (p.isOverdue ? 1 : 0),
    }),
    { open: 0, overdue: 0, blocked: 0, late: 0 },
  );

  const stats = [
    { label: "Projects in progress", value: projects.length },
    { label: "Open tasks", value: totals.open },
    { label: "Overdue tasks", value: totals.overdue, alert: totals.overdue > 0 },
    { label: "Blocked tasks", value: totals.blocked, alert: totals.blocked > 0 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pending Progress</h1>
        <p className="text-sm text-muted-foreground">Everything that is still open, soonest deadline first.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-semibold tabular-nums ${s.alert ? "text-red-600 dark:text-red-400" : ""}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Hourglass className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No pending work — every project is completed or cancelled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {project.manager ? `Manager: ${project.manager.name} · ` : ""}
                      {project.endDate ? `Due ${new Date(project.endDate).toLocaleDateString()}` : "No end date"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {project.isOverdue && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="size-3.5" />
                        Past deadline
                      </span>
                    )}
                    <PriorityBadge priority={project.priority} />
                    <StatusBadge status={project.status} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-2" />
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {project.progress}% done
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {project.tasks.length} of {project._count.tasks} tasks remaining
                  {project.overdueTasks > 0 && (
                    <span className="text-red-600 dark:text-red-400"> · {project.overdueTasks} overdue</span>
                  )}
                  {project.blockedTasks > 0 && (
                    <span className="text-red-600 dark:text-red-400"> · {project.blockedTasks} blocked</span>
                  )}
                </p>

                {project.tasks.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-primary hover:underline">
                      Show remaining tasks
                    </summary>
                    <div className="mt-2 space-y-2">
                      {project.tasks.map((task) => (
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
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
