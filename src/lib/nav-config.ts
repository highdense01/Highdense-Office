import type { PermissionKey } from "@/lib/permissions/constants";
import { PERMISSIONS } from "@/lib/permissions/constants";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListChecks,
  CheckSquare,
  FolderKanban,
  Video,
  CalendarDays,
  MessageSquare,
  Bell,
  Users,
  ShieldCheck,
  Building2,
  IdCard,
  History,
  BarChart3,
  Activity,
  Settings,
  UserCircle,
  Pin,
  Layers,
  Hourglass,
  CircleCheckBig,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Todos", href: "/todos", icon: ListChecks },
      { label: "My Tasks", href: "/tasks", icon: CheckSquare, permission: PERMISSIONS.TASK_VIEW },
      { label: "Projects", href: "/projects", icon: FolderKanban, permission: PERMISSIONS.PROJECT_VIEW },
    ],
  },
  {
    title: "Project Hub",
    items: [
      { label: "Pinned", href: "/projects/pinned", icon: Pin, permission: PERMISSIONS.PROJECT_VIEW },
      { label: "Tech Stack", href: "/tech-stack", icon: Layers, permission: PERMISSIONS.PROJECT_VIEW },
      { label: "Pending Progress", href: "/projects/pending", icon: Hourglass, permission: PERMISSIONS.PROJECT_VIEW },
      { label: "Completed", href: "/projects/completed", icon: CircleCheckBig, permission: PERMISSIONS.PROJECT_VIEW },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Chat", href: "/chat", icon: MessageSquare, permission: PERMISSIONS.CHAT_VIEW },
      { label: "Meetings", href: "/meetings", icon: Video, permission: PERMISSIONS.MEETING_VIEW },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Employees", href: "/employees", icon: Users, permission: PERMISSIONS.USER_VIEW },
      { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck, permission: PERMISSIONS.ROLE_VIEW },
      { label: "Departments", href: "/departments", icon: Building2, permission: PERMISSIONS.DEPARTMENT_VIEW },
      { label: "Designations", href: "/designations", icon: IdCard, permission: PERMISSIONS.DESIGNATION_VIEW },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Employee Monitoring", href: "/monitoring", icon: Activity, permission: PERMISSIONS.ACTIVITY_VIEW },
      { label: "Activity Logs", href: "/activity-logs", icon: History, permission: PERMISSIONS.ACTIVITY_VIEW },
      { label: "Reports", href: "/reports", icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: UserCircle },
      { label: "Settings", href: "/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
];

export function getVisibleNavSections(user: {
  isAdmin: boolean;
  permissions: PermissionKey[];
}): NavSection[] {
  const canSee = (item: NavItem) => !item.permission || user.isAdmin || user.permissions.includes(item.permission);

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(canSee),
  })).filter((section) => section.items.length > 0);
}
