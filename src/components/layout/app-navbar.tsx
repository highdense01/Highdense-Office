import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsDropdown } from "./notifications-dropdown";
import { UserMenu } from "./user-menu";
import { GlobalSearch } from "@/components/search/global-search";
import type { SessionUser } from "@/lib/permissions/check";

export function AppNavbar({ user, canSwitchRole }: { user: SessionUser; canSwitchRole: boolean }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex-1">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationsDropdown />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu name={user.name} email={user.email} image={user.image} roleName={user.roleName} roleNames={user.assignedRoleNames} canSwitchRole={canSwitchRole} />
      </div>
    </header>
  );
}
