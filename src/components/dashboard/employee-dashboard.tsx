import Link from "next/link";
import { CheckCircle2, ListTodo, Clock, AlertTriangle, Video, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "./stat-card";
import { TaskProgressRow } from "@/components/tasks/task-progress-row";
import { formatDistanceToNow } from "date-fns";
import type { getEmployeeDashboardStats } from "@/server/services/dashboard";

export function EmployeeDashboard({ stats }: { stats: Awaited<ReturnType<typeof getEmployeeDashboardStats>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Today's Tasks" value={stats.todaysTasks.length} icon={ListTodo} />
        <StatCard label="Pending" value={stats.pendingTasks.length} icon={Clock} tone="warning" />
        <StatCard label="In Progress" value={stats.inProgressTasks.length} icon={ListTodo} />
        <StatCard label="Completed" value={stats.completedTasks.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue" value={stats.overdueTasks.length} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.upcomingDeadlines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No upcoming deadlines. Nice work!</p>
            ) : (
              stats.upcomingDeadlines.map((task) => (
                <TaskProgressRow
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  projectName={task.project?.name}
                  status={task.status}
                  priority={task.priority}
                  progress={task.progress}
                  dueDate={task.dueDate}
                />
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Today&apos;s Meetings</CardTitle>
              <Video className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.upcomingMeetings.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No meetings scheduled.</p>
              ) : (
                stats.upcomingMeetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href="/meetings"
                    className="block rounded-md border p-2 text-sm hover:bg-muted/50"
                  >
                    <p className="font-medium">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Recent Messages</CardTitle>
              <MessageSquare className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.recentMessages.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No recent messages.</p>
              ) : (
                stats.recentMessages.map((message) => (
                  <div key={message.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">{message.sender.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{message.content}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">My Pending Todos</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.pendingTodos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No todos yet.{" "}
              <Link href="/todos" className="text-primary hover:underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stats.pendingTodos.map((todo) => (
                <li key={todo.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{todo.title}</span>
                  {todo.dueDate && (
                    <span className="text-xs text-muted-foreground">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
