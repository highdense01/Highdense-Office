import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/permissions/check";
import { DASHBOARD_MIN_LEVEL } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";

export async function getAdminDashboardStats(userId: string) {
  const now = new Date();

  const [
    totalEmployees,
    activeEmployees,
    totalProjects,
    activeTasks,
    completedTasks,
    overdueTasks,
    pendingTasks,
    meetingsToday,
    unreadMessages,
    tasksByStatus,
    tasksByPriority,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, accountStatus: "ACTIVE" } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null, status: { in: ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED"] } } }),
    prisma.task.count({ where: { deletedAt: null, status: "COMPLETED" } }),
    prisma.task.count({
      where: { deletedAt: null, dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    prisma.task.count({ where: { deletedAt: null, status: "TODO" } }),
    prisma.meeting.count({
      where: {
        status: { not: "CANCELLED" },
        date: { gte: new Date(now.setHours(0, 0, 0, 0)), lt: new Date(now.setHours(24, 0, 0, 0)) },
      },
    }),
    prisma.notification.count({ where: { isRead: false, userId } }),
    prisma.task.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.task.groupBy({ by: ["priority"], where: { deletedAt: null }, _count: true }),
  ]);

  const recentActivities = await prisma.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return {
    totalEmployees,
    activeEmployees,
    totalProjects,
    activeTasks,
    completedTasks,
    overdueTasks,
    pendingTasks,
    meetingsToday,
    unreadMessages,
    tasksByStatus: tasksByStatus.map((t) => ({ status: t.status, count: t._count })),
    tasksByPriority: tasksByPriority.map((t) => ({ priority: t.priority, count: t._count })),
    recentActivities,
  };
}

export async function getEmployeeDashboardStats(userId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);

  const [myTasks, pendingTodos, upcomingMeetings, recentMessages] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: userId, deletedAt: null },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.todo.findMany({ where: { userId, status: { not: "COMPLETED" } }, orderBy: { dueDate: "asc" } }),
    prisma.meeting.findMany({
      where: { participants: { some: { userId } }, status: { not: "CANCELLED" }, date: { gte: startOfDay } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.message.findMany({
      where: {
        OR: [
          { conversation: { OR: [{ participantOneId: userId }, { participantTwoId: userId }] } },
          { room: { members: { some: { userId } } } },
        ],
        senderId: { not: userId },
      },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const todaysTasks = myTasks.filter((t) => t.dueDate && t.dueDate >= startOfDay && t.dueDate < endOfDay);
  const overdueTasks = myTasks.filter(
    (t) => t.dueDate && t.dueDate < startOfDay && !["COMPLETED", "CANCELLED"].includes(t.status),
  );

  return {
    myTasks,
    todaysTasks,
    pendingTasks: myTasks.filter((t) => t.status === "TODO"),
    inProgressTasks: myTasks.filter((t) => t.status === "IN_PROGRESS"),
    completedTasks: myTasks.filter((t) => t.status === "COMPLETED"),
    overdueTasks,
    upcomingDeadlines: myTasks
      .filter((t) => t.dueDate && !["COMPLETED", "CANCELLED"].includes(t.status))
      .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1))
      .slice(0, 5),
    pendingTodos,
    upcomingMeetings,
    recentMessages,
  };
}

/** Projects, tasks and people the user is responsible for (their own projects + direct reports), not the whole company. */
export async function getTeamDashboardStats(actor: SessionUser) {
  const now = new Date();

  const projects = await prisma.project.findMany({
    where: { ...projectAccessWhere(actor), status: { notIn: ["COMPLETED", "CANCELLED"] } },
    select: {
      id: true,
      name: true,
      status: true,
      priority: true,
      progress: true,
      endDate: true,
      members: { select: { userId: true } },
    },
  });
  const projectIds = projects.map((p) => p.id);

  const [tasks, directReports] = await Promise.all([
    prisma.task.findMany({
      where: { deletedAt: null, projectId: { in: projectIds } },
      select: { status: true, dueDate: true, assignedToId: true, assignedTo: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { managerId: actor.id, deletedAt: null, accountStatus: "ACTIVE" },
      select: { id: true, name: true },
    }),
  ]);

  const isOpen = (status: string) => !["COMPLETED", "CANCELLED"].includes(status);
  const openTasks = tasks.filter((t) => isOpen(t.status));
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < now);

  // Workload per person: assignees on these projects plus direct reports (who may have nothing yet).
  const workload = new Map<string, { id: string; name: string; open: number; overdue: number }>();
  for (const r of directReports) workload.set(r.id, { id: r.id, name: r.name, open: 0, overdue: 0 });
  for (const t of openTasks) {
    if (!t.assignedToId || !t.assignedTo) continue;
    const row = workload.get(t.assignedToId) ?? { id: t.assignedToId, name: t.assignedTo.name, open: 0, overdue: 0 };
    row.open += 1;
    if (t.dueDate && t.dueDate < now) row.overdue += 1;
    workload.set(t.assignedToId, row);
  }

  const teamIds = new Set([...directReports.map((r) => r.id), ...projects.flatMap((p) => p.members.map((m) => m.userId))]);

  const statusCounts = new Map<string, number>();
  for (const t of tasks) statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);

  return {
    projectCount: projects.length,
    openTasks: openTasks.length,
    overdueTasks: overdue.length,
    blockedTasks: openTasks.filter((t) => t.status === "BLOCKED").length,
    teamSize: teamIds.size,
    tasksByStatus: [...statusCounts].map(([status, count]) => ({ status, count })),
    // Projects needing attention first: past deadline, then least progress.
    projectsNeedingAttention: projects
      .map((p) => ({ ...p, pastDeadline: !!p.endDate && p.endDate < now }))
      .sort((a, b) => Number(b.pastDeadline) - Number(a.pastDeadline) || a.progress - b.progress)
      .slice(0, 5),
    workload: [...workload.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open).slice(0, 8),
  };
}

export type DashboardTier = "admin" | "team" | "employee";

/** Which dashboard a role level gets: company-wide (Admin+), team (Manager / Team Lead), or personal. */
export function dashboardTierForLevel(level: number): DashboardTier {
  if (level >= DASHBOARD_MIN_LEVEL.company) return "admin";
  if (level >= DASHBOARD_MIN_LEVEL.team) return "team";
  return "employee";
}

export interface DashboardView {
  roleId: string | null;
  roleName: string;
  tier: DashboardTier;
}

/**
 * Dashboards for the signed-in user (which, while an admin is viewing the app as someone else, is that
 * person). A user holding several roles gets one view PER ROLE, each with that role's own dashboard, so
 * nothing is merged. Stats are fetched once per distinct tier even if two roles share it.
 */
export async function getDashboardsForUser(user: SessionUser) {
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: { select: { id: true, name: true, level: true, isActive: true, deletedAt: true } },
      userRoles: {
        select: { role: { select: { id: true, name: true, level: true, isActive: true, deletedAt: true } } },
      },
    },
  });

  const usable = (r: { id: string; name: string; level: number; isActive: boolean; deletedAt: Date | null } | null | undefined) =>
    r && r.isActive && !r.deletedAt ? r : null;
  const assigned = [usable(me?.role), ...(me?.userRoles ?? []).map((ur) => usable(ur.role))].filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  // Previewing a lower role you don't hold (or no usable assigned role): a single view of the active role.
  const activeIsAssigned = assigned.some((r) => r.id === user.roleId);
  const views: DashboardView[] =
    activeIsAssigned && assigned.length > 1
      ? assigned.map((r) => ({
          roleId: r.id,
          roleName: r.name,
          tier: r.level >= 100 ? "admin" : dashboardTierForLevel(r.level),
        }))
      : [
          {
            roleId: user.roleId,
            roleName: user.roleName ?? "Employee",
            tier: user.isAdmin ? "admin" : dashboardTierForLevel(user.roleLevel),
          },
        ];

  const tiers = [...new Set(views.map((v) => v.tier))];
  const [admin, team, employee] = await Promise.all([
    tiers.includes("admin") ? getAdminDashboardStats(user.id) : null,
    tiers.includes("team")
      ? Promise.all([getTeamDashboardStats(user), getEmployeeDashboardStats(user.id)]).then(([t, mine]) => ({ team: t, mine }))
      : null,
    tiers.includes("employee") ? getEmployeeDashboardStats(user.id) : null,
  ]);

  return {
    views,
    defaultRoleId: views.find((v) => v.roleId === user.roleId)?.roleId ?? views[0].roleId,
    data: { admin, team, employee },
  };
}
