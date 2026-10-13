import { listProjects } from "@/server/actions/projects";
import { listPinnedProjectIds } from "@/server/actions/project-hub";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const [projects, employees, pinnedIds] = await Promise.all([
    listProjects(),
    prisma.user.findMany({ where: { deletedAt: null, accountStatus: "ACTIVE" }, orderBy: { name: "asc" } }),
    listPinnedProjectIds(),
  ]);

  return (
    <ProjectsClient projects={projects} employees={employees} pinnedIds={pinnedIds} canCreate={hasPermission(user, PERMISSIONS.PROJECT_CREATE)} />
  );
}
