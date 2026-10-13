import { getEmployeeMonitoringOverview } from "@/server/services/monitoring";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default async function MonitoringPage() {
  await requirePermission(PERMISSIONS.ACTIVITY_VIEW);
  const employees = await getEmployeeMonitoringOverview();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Employee Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Legitimate application-activity overview only — task counts and last recorded action. No keystroke, screen, or
          webcam tracking.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead className="text-right">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell className="text-muted-foreground">{employee.department ?? "—"}</TableCell>
                  <TableCell>{employee.activeTasks}</TableCell>
                  <TableCell>{employee.completedTasks}</TableCell>
                  <TableCell>
                    {employee.overdueTasks > 0 ? (
                      <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
                        {employee.overdueTasks}
                      </Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell>{employee.projectCount}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {employee.lastActivityAt
                      ? formatDistanceToNow(new Date(employee.lastActivityAt), { addSuffix: true })
                      : "No activity yet"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
