import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Legitimate, application-activity-based monitoring only (spec section 24):
 * task/project counts and the timestamp of the user's last logged action.
 * No keystroke, screen, or webcam capture of any kind.
 */
export async function getEmployeeMonitoringOverview() {
  const employees = await prisma.user.findMany({
    where: { deletedAt: null, accountStatus: "ACTIVE" },
    include: {
      department: true,
      tasksAssigned: { where: { deletedAt: null }, select: { status: true, dueDate: true } },
      projectMemberships: { select: { projectId: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const now = new Date();

  return employees.map((employee) => {
    const activeTasks = employee.tasksAssigned.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length;
    const completedTasks = employee.tasksAssigned.filter((t) => t.status === "COMPLETED").length;
    const overdueTasks = employee.tasksAssigned.filter(
      (t) => t.dueDate && t.dueDate < now && !["COMPLETED", "CANCELLED"].includes(t.status),
    ).length;

    return {
      id: employee.id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department?.name ?? null,
      activeTasks,
      completedTasks,
      overdueTasks,
      projectCount: new Set(employee.projectMemberships.map((p) => p.projectId)).size,
      lastActivityAt: employee.activityLogs[0]?.createdAt ?? null,
    };
  });
}
