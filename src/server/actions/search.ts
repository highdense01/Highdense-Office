"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";

export interface SearchResult {
  id: string;
  type: "employee" | "project" | "task" | "meeting";
  title: string;
  subtitle?: string;
  href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const actor = await requireAuth();
  const term = query.trim();
  if (term.length < 2) return [];

  const results: SearchResult[] = [];

  if (hasPermission(actor, PERMISSIONS.USER_VIEW)) {
    const employees = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: term } }, { email: { contains: term } }, { employeeId: { contains: term } }],
      },
      take: 5,
      select: { id: true, name: true, employeeId: true },
    });
    results.push(
      ...employees.map((e) => ({
        id: e.id,
        type: "employee" as const,
        title: e.name,
        subtitle: e.employeeId ?? undefined,
        href: `/employees/${e.id}`,
      })),
    );
  }

  if (hasPermission(actor, PERMISSIONS.PROJECT_VIEW)) {
    const projects = await prisma.project.findMany({
      where: { ...projectAccessWhere(actor), name: { contains: term } },
      take: 5,
      select: { id: true, name: true, status: true },
    });
    results.push(
      ...projects.map((p) => ({
        id: p.id,
        type: "project" as const,
        title: p.name,
        subtitle: p.status,
        href: `/projects/${p.id}`,
      })),
    );
  }

  const taskWhere = hasPermission(actor, PERMISSIONS.USER_VIEW)
    ? { deletedAt: null, title: { contains: term } }
    : { deletedAt: null, title: { contains: term }, assignedToId: actor.id };
  const tasks = await prisma.task.findMany({ where: taskWhere, take: 5, select: { id: true, title: true, status: true } });
  results.push(
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      subtitle: t.status,
      href: `/tasks/${t.id}`,
    })),
  );

  const meetings = await prisma.meeting.findMany({
    where: { title: { contains: term }, participants: { some: { userId: actor.id } } },
    take: 5,
    select: { id: true, title: true, date: true },
  });
  results.push(
    ...meetings.map((m) => ({
      id: m.id,
      type: "meeting" as const,
      title: m.title,
      subtitle: new Date(m.date).toLocaleDateString(),
      href: `/meetings`,
    })),
  );

  return results;
}
