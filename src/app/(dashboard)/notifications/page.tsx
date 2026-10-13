import { listMyNotifications } from "@/server/actions/notifications";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  const notifications = await listMyNotifications(100);
  return <NotificationsClient notifications={notifications} />;
}
