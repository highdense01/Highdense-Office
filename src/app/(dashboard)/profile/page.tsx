import { notFound } from "next/navigation";
import { getMyProfile } from "@/server/actions/employees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ChangePasswordCard } from "./change-password-card";

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) notFound();

  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarImage src={profile.image ?? undefined} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.designation?.name ?? "—"} · {profile.department?.name ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {profile.role && <Badge variant="secondary">{profile.role.name}</Badge>}
          {profile.userRoles.map((ur) => (
            <Badge key={ur.id} variant="outline">
              {ur.role.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Employee ID" value={profile.employeeId ?? "—"} />
            <Row label="Email" value={profile.email} />
            <Row label="Phone" value={profile.phone ?? "—"} />
            <Row label="Manager" value={profile.manager?.name ?? "—"} />
            <Row label="Joining Date" value={profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : "—"} />
            <Row label="Employment Status" value={profile.employmentStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">My Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.projectMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not part of any project yet.</p>
            ) : (
              profile.projectMemberships.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{pm.project.name}</span>
                  <StatusBadge status={pm.project.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.tasksAssigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
          ) : (
            profile.tasksAssigned.map((task) => (
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

      <div id="password" className="scroll-mt-20">
        <ChangePasswordCard hasPassword={!!profile.passwordHash} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
