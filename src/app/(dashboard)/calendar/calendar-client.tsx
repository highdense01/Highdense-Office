"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Video, CheckSquare, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getCalendarEvents, type CalendarEvent } from "@/server/actions/calendar";

const EVENT_ICON = { meeting: Video, task_deadline: CheckSquare, project_milestone: Flag } as const;
const EVENT_COLOR = {
  meeting: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  task_deadline: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  project_milestone: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
} as const;

export function CalendarClient({ initialEvents, initialMonth }: { initialEvents: CalendarEvent[]; initialMonth: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(initialMonth));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    getCalendarEvents(start, end).then(setEvents);
  }, [currentMonth]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(new Date(event.date), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const selectedDayEvents = eventsByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">Meetings, task deadlines, and project milestones.</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <p className="font-medium">{format(currentMonth, "MMMM yyyy")}</p>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {view === "day" ? (
              <p className="text-sm text-muted-foreground">
                Showing {format(selectedDate, "EEEE, MMM d")}. Switch to Month view to pick a different day.
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1 font-medium">
                    {d}
                  </div>
                ))}
                {days
                  .filter((day) => view === "month" || isSameDay(startOfWeek(day), startOfWeek(selectedDate)))
                  .map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDay.get(key) ?? [];
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "flex min-h-16 flex-col items-start gap-1 rounded-md border p-1.5 text-left align-top hover:bg-muted/50",
                          !isSameMonth(day, currentMonth) && "opacity-40",
                          isSameDay(day, selectedDate) && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <span className={cn("text-xs", isSameDay(day, new Date()) && "font-bold text-primary")}>
                          {format(day, "d")}
                        </span>
                        {dayEvents.slice(0, 2).map((e) => (
                          <span key={e.id} className={cn("w-full truncate rounded px-1 text-[10px]", EVENT_COLOR[e.type])}>
                            {e.title}
                          </span>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">{format(selectedDate, "EEEE, MMMM d")}</p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events on this day.</p>
            ) : (
              selectedDayEvents.map((event) => {
                const Icon = EVENT_ICON[event.type];
                return (
                  <Link
                    key={event.id}
                    href={event.href}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                  >
                    <span className={cn("flex size-7 items-center justify-center rounded-md", EVENT_COLOR[event.type])}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(event.date), "p")}</span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
