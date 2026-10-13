import { notFound } from "next/navigation";
import { getEmployeeDetail } from "@/server/actions/employees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { formatDistanceToNow } from "date-fns";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployeeDetail(id);
  if (!employee) notFound();

  const initials = employee.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarImage src={employee.image ?? undefined} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{employee.name}</h1>
          <p className="text-sm text-muted-foreground">
            {employee.designation?.name ?? "—"} · {employee.department?.name ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {employee.role && <Badge variant="secondary">{employee.role.name}</Badge>}
          {employee.userRoles.map((ur) => (
            <Badge key={ur.id} variant="outline">
              {ur.role.name}
            </Badge>
          ))}
          <Badge
            variant="outline"
            className={
              employee.accountStatus === "ACTIVE"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-gray-500/20 bg-gray-500/10 text-gray-500"
            }
          >
            {employee.accountStatus}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Employee ID" value={employee.employeeId ?? "—"} />
            <DetailRow label="Email" value={employee.email} />
            <DetailRow label="Phone" value={employee.phone ?? "—"} />
            <DetailRow label="Manager" value={employee.manager?.name ?? "—"} />
            <DetailRow
              label="Joining Date"
              value={employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : "—"}
            />
            <DetailRow label="Employment Status" value={employee.employmentStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Projects ({employee.projectMemberships.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.projectMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not part of any project yet.</p>
            ) : (
              employee.projectMemberships.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{pm.project.name}</span>
                  <StatusBadge status={pm.project.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.activityLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              employee.activityLogs.map((log) => (
                <div key={log.id} className="text-sm">
                  <p className="truncate">{log.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tasks ({employee.tasksAssigned.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employee.tasksAssigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
          ) : (
            employee.tasksAssigned.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title}</p>
                  {task.project && <p className="truncate text-xs text-muted-foreground">{task.project.name}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
