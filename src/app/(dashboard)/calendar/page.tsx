import { startOfMonth, startOfWeek, endOfMonth, endOfWeek } from "date-fns";
import { getCalendarEvents } from "@/server/actions/calendar";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const now = new Date();
  const start = startOfWeek(startOfMonth(now));
  const end = endOfWeek(endOfMonth(now));
  const events = await getCalendarEvents(start, end);

  return <CalendarClient initialEvents={events} initialMonth={now.toISOString()} />;
}
