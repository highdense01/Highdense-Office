import { getActivityLogs, getDistinctActivityActions } from "@/server/actions/activity-logs";
import { ActivityLogsClient } from "./activity-logs-client";

export default async function ActivityLogsPage() {
  const [{ logs, totalPages }, actions] = await Promise.all([getActivityLogs({ page: 1 }), getDistinctActivityActions()]);

  return <ActivityLogsClient initialLogs={logs} initialTotalPages={totalPages} actions={actions} />;
}
