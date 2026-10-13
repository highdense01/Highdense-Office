import { listMyMeetings, listAllMeetings } from "@/server/actions/meetings";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { MeetingsClient } from "./meetings-client";

export default async function MeetingsPage() {
  const user = await requireAuth();
  const canViewAll = hasPermission(user, PERMISSIONS.MEETING_VIEW);

  const [meetings, employees] = await Promise.all([
    canViewAll ? listAllMeetings() : listMyMeetings(),
    prisma.user.findMany({ where: { deletedAt: null, accountStatus: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <MeetingsClient
      meetings={meetings}
      employees={employees}
      canCreate={hasPermission(user, PERMISSIONS.MEETING_CREATE)}
      canDelete={hasPermission(user, PERMISSIONS.MEETING_DELETE)}
    />
  );
}
