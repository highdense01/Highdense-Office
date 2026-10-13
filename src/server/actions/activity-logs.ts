"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import type { Prisma } from "@prisma/client";

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  await requirePermission(PERMISSIONS.ACTIVITY_VIEW);

  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);

  const where: Prisma.ActivityLogWhereInput = {
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.action && { action: filters.action }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.search && { description: { contains: filters.search } }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, employeeId: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getDistinctActivityActions() {
  await requirePermission(PERMISSIONS.ACTIVITY_VIEW);
  const rows = await prisma.activityLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
  });
  return rows.map((r) => r.action);
}
