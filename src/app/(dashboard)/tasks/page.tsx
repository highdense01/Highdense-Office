import { listTasks } from "@/server/actions/tasks";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { projectAccessWhere } from "@/lib/permissions/project-access";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const user = await requireAuth();
  const [tasks, projects, employees] = await Promise.all([
    listTasks(),
    prisma.project.findMany({ where: projectAccessWhere(user), orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null, accountStatus: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <TasksClient tasks={tasks} projects={projects} assignees={employees} canCreate={hasPermission(user, PERMISSIONS.TASK_CREATE)} />
  );
}
