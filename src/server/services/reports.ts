import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions/check";
import { projectAccessWhere } from "@/lib/permissions/project-access";

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  projectId?: string;
  employeeId?: string;
}

function dateRange(filters: ReportFilters) {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return {
    ...(filters.dateFrom && { gte: filters.dateFrom }),
    ...(filters.dateTo && { lte: filters.dateTo }),
  };
}

export async function getTaskCompletionReport(filters: ReportFilters = {}) {
  const createdAt = dateRange(filters);
  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(createdAt && { createdAt }),
    ...(filters.projectId && { projectId: filters.projectId }),
    ...(filters.employeeId && { assignedToId: filters.employeeId }),
    ...(filters.departmentId && { assignedTo: { departmentId: filters.departmentId } }),
  };

  const [byStatus, total, completed, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where, _count: true }),
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.task.count({
      where: { ...where, dueDate: { lt: new Date() }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
  ]);

  return {
    total,
    completed,
    overdue,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
  };
}

export async function getProjectProgressReport(actor: SessionUser, filters: ReportFilters = {}) {
  const where: Prisma.ProjectWhereInput = {
    ...projectAccessWhere(actor),
    ...(filters.projectId && { id: filters.projectId }),
  };
  return prisma.project.findMany({
    where,
    select: { id: true, name: true, status: true, priority: true, progress: true, endDate: true },
    orderBy: { progress: "asc" },
  });
}

export async function getDepartmentWorkloadReport() {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          tasksAssigned: { where: { deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } }, select: { id: true } },
        },
      },
    },
  });

  return departments.map((d) => ({
    department: d.name,
    employeeCount: d.users.length,
    activeTaskCount: d.users.reduce((sum, u) => sum + u.tasksAssigned.length, 0),
  }));
}

export async function getEmployeeWorkloadReport(filters: ReportFilters = {}) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.employeeId && { id: filters.employeeId }),
    },
    select: {
      id: true,
      name: true,
      employeeId: true,
      department: { select: { name: true } },
      tasksAssigned: { where: { deletedAt: null }, select: { status: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    employeeId: u.employeeId,
    department: u.department?.name ?? null,
    activeTasks: u.tasksAssigned.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length,
    completedTasks: u.tasksAssigned.filter((t) => t.status === "COMPLETED").length,
  }));
}

export async function getActivitySummaryReport(filters: ReportFilters = {}) {
  const createdAt = dateRange(filters);
  const grouped = await prisma.activityLog.groupBy({
    by: ["action"],
    where: {
      ...(createdAt && { createdAt }),
      ...(filters.employeeId && { userId: filters.employeeId }),
    },
    _count: true,
    orderBy: { _count: { action: "desc" } },
  });
  return grouped.map((g) => ({ action: g.action, count: g._count }));
}
