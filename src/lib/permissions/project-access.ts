import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "./check";

/**
 * The ONE rule for who may see or change a project: its manager, its creator,
 * or one of its members. Only the Super Admin flag (`isAdmin`) bypasses it.
 *
 * Holding `project.view` / `user.view` does NOT widen access — those permissions
 * say a user may use the feature, this says which projects they may use it on.
 */
export function projectAccessWhere(actor: SessionUser): Prisma.ProjectWhereInput {
  if (actor.isAdmin) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ managerId: actor.id }, { createdById: actor.id }, { members: { some: { userId: actor.id } } }],
  };
}

/** True if `actor` may access the project. Use before any read or write that targets a project by id. */
export async function canAccessProject(actor: SessionUser, projectId: string): Promise<boolean> {
  const found = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(actor) },
    select: { id: true },
  });
  return found !== null;
}
