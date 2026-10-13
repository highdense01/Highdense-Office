import { Users, UserCheck, FolderKanban, ListTodo, CheckCircle2, AlertTriangle, Clock, Video, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "./stat-card";
import { TasksByStatusChart } from "./tasks-by-status-chart";
import { TasksByPriorityChart } from "./tasks-by-priority-chart";
import type { getAdminDashboardStats } from "@/server/services/dashboard";

export function AdminDashboard({ stats }: { stats: Awaited<ReturnType<typeof getAdminDashboardStats>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Employees" value={stats.totalEmployees} icon={Users} />
        <StatCard label="Active Employees" value={stats.activeEmployees} icon={UserCheck} tone="success" />
        <StatCard label="Projects" value={stats.totalProjects} icon={FolderKanban} />
        <StatCard label="Active Tasks" value={stats.activeTasks} icon={ListTodo} />
        <StatCard label="Completed Tasks" value={stats.completedTasks} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue Tasks" value={stats.overdueTasks} icon={AlertTriangle} tone="danger" />
        <StatCard label="Pending Tasks" value={stats.pendingTasks} icon={Clock} tone="warning" />
        <StatCard label="Meetings Today" value={stats.meetingsToday} icon={Video} />
        <StatCard label="Unread Notifications" value={stats.unreadMessages} icon={MessageSquare} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByStatusChart data={stats.tasksByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByPriorityChart data={stats.tasksByPriority} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="divide-y">
              {stats.recentActivities.map((activity) => (
                <li key={activity.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate">{activity.description}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
