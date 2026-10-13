import { requireAuth } from "@/lib/permissions/check";
import { getDashboardsForUser, type DashboardTier } from "@/server/services/dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TeamDashboard } from "@/components/dashboard/team-dashboard";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SUBTITLE: Record<DashboardTier, string> = {
  admin: "Company-wide overview",
  team: "Your projects and team",
  employee: "Here's what's on your plate today",
};

export default async function DashboardPage() {
  const user = await requireAuth();
  const { views, defaultRoleId, data } = await getDashboardsForUser(user);

  function renderTier(tier: DashboardTier) {
    if (tier === "admin" && data.admin) return <AdminDashboard stats={data.admin} />;
    if (tier === "team" && data.team) {
      return (
        <>
          <TeamDashboard stats={data.team.team} />
          <div className="space-y-3">
            <h2 className="text-sm font-medium">My work</h2>
            <EmployeeDashboard stats={data.team.mine} />
          </div>
        </>
      );
    }
    if (tier === "employee" && data.employee) return <EmployeeDashboard stats={data.employee} />;
    return null;
  }

  const single = views.length === 1;

  return (
    <div className="space-y-1">
      <div>
        <h1 className="text-xl font-semibold">Welcome back, {user.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-sm text-muted-foreground">
          {single
            ? `${SUBTITLE[views[0].tier]}${views[0].roleName ? ` · ${views[0].roleName}` : ""}`
            : `You hold ${views.length} roles. Each has its own dashboard.`}
        </p>
      </div>

      {single ? (
        <div className="space-y-6 pt-4">{renderTier(views[0].tier)}</div>
      ) : (
        <Tabs defaultValue={defaultRoleId ?? undefined} className="pt-4">
          <TabsList>
            {views.map((v) => (
              <TabsTrigger key={v.roleId} value={v.roleId ?? v.roleName}>
                {v.roleName}
              </TabsTrigger>
            ))}
          </TabsList>
          {views.map((v) => (
            <TabsContent key={v.roleId} value={v.roleId ?? v.roleName} className="space-y-6 pt-2">
              <p className="text-sm text-muted-foreground">{SUBTITLE[v.tier]}</p>
              {renderTier(v.tier)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
