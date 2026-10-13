import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppNavbar } from "@/components/layout/app-navbar";
import { RoleSwitchBanner } from "@/components/layout/role-switch-banner";
import { IdleSessionManager } from "@/components/auth/idle-session-manager";
import { SessionSyncWatcher } from "@/components/auth/session-sync";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.accountStatus !== "ACTIVE") redirect("/login?error=AccountInactive");

  const user = session.user;

  return (
    <SidebarProvider>
      <IdleSessionManager />
      <SessionSyncWatcher />
      {/* AppSidebar computes visible nav items itself (client-side) — nav
          config holds icon COMPONENT references, which can't cross the
          server->client boundary as props (RSC only serializes data). */}
      <AppSidebar isAdmin={user.isAdmin} permissions={user.permissions} />
      <SidebarInset>
        {user.isActingAs && (
          <RoleSwitchBanner actingAs={user.roleName} ownRole={user.realRoleName} />
        )}
        <AppNavbar user={user} canSwitchRole={user.canSwitchRole} />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
