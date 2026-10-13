import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  getTaskCompletionReport,
  getProjectProgressReport,
  getDepartmentWorkloadReport,
  getEmployeeWorkloadReport,
} from "@/server/services/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/tasks/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { CheckCircle2, ListTodo, AlertTriangle, TrendingUp } from "lucide-react";
import { TasksByStatusChart } from "@/components/dashboard/tasks-by-status-chart";

export default async function ReportsPage() {
  const actor = await requirePermission(PERMISSIONS.REPORT_VIEW);

  const [taskCompletion, projectProgress, departmentWorkload, employeeWorkload] = await Promise.all([
    getTaskCompletionReport(),
    getProjectProgressReport(actor),
    getDepartmentWorkloadReport(),
    getEmployeeWorkloadReport(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Company-wide productivity and progress reports.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Tasks" value={taskCompletion.total} icon={ListTodo} />
        <StatCard label="Completed" value={taskCompletion.completed} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue" value={taskCompletion.overdue} icon={AlertTriangle} tone="danger" />
        <StatCard label="Completion Rate" value={`${taskCompletion.completionRate}%`} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Task Completion by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByStatusChart data={taskCompletion.byStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Department Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {departmentWorkload.map((d) => (
              <div key={d.department} className="flex items-center justify-between text-sm">
                <span>{d.department}</span>
                <span className="text-muted-foreground">
                  {d.activeTaskCount} active tasks · {d.employeeCount} employees
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {projectProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            projectProgress.map((project) => (
              <div key={project.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{project.name}</span>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5" />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {project.progress}%
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Employee Workload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employeeWorkload.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{employee.name}</span>
                {employee.department && <span className="ml-2 text-xs text-muted-foreground">{employee.department}</span>}
              </div>
              <span className="text-muted-foreground">
                {employee.activeTasks} active · {employee.completedTasks} completed
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
