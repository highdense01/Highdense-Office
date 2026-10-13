import Link from "next/link";
import { CircleCheckBig, Clock } from "lucide-react";
import { getCompletedProjects } from "@/server/actions/project-hub";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TechBadge } from "@/components/projects/tech-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import type { TechCategory } from "@/lib/validations/project-tech";

export default async function CompletedProjectsPage() {
  const projects = await getCompletedProjects();

  const withDeadline = projects.filter((p) => p.onTime !== null);
  const onTimeCount = withDeadline.filter((p) => p.onTime).length;
  const avgDuration = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + p.durationDays, 0) / projects.length)
    : 0;

  const stats = [
    { label: "Projects completed", value: projects.length },
    {
      label: "Delivered on time",
      value: withDeadline.length ? `${Math.round((onTimeCount / withDeadline.length) * 100)}%` : "—",
    },
    { label: "Avg. duration", value: projects.length ? `${avgDuration} days` : "—" },
    {
      label: "Hours logged",
      value: Math.round(projects.reduce((sum, p) => sum + p.hoursLogged, 0)).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Completed Projects</h1>
        <p className="text-sm text-muted-foreground">Delivered work, most recently finished first.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CircleCheckBig className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No completed projects yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Completed {project.completedAt.toLocaleDateString()}
                      {project.manager ? ` · ${project.manager.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {project.onTime === true && (
                      <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 font-normal text-emerald-600 dark:text-emerald-400">
                        On time
                      </Badge>
                    )}
                    {project.onTime === false && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 font-normal text-amber-600 dark:text-amber-400">
                        Delivered late
                      </Badge>
                    )}
                    <PriorityBadge priority={project.priority} />
                  </div>
                </div>

                {project.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CircleCheckBig className="size-3.5" />
                    {project.taskDone}/{project.taskTotal} tasks done
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {project.durationDays} days
                  </span>
                  {project.hoursLogged > 0 && <span>{Math.round(project.hoursLogged)} h logged</span>}
                </div>

                {project.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.techStack.map((t) => (
                      <TechBadge key={t.id} name={t.name} category={t.category as TechCategory} version={t.version} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
