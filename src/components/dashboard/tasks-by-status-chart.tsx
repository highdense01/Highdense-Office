"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const STATUS_ORDER = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"] as const;
const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const chartConfig = {
  count: { label: "Tasks", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TasksByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const countByStatus = new Map(data.map((d) => [d.status, d.count]));
  const chartData = STATUS_ORDER.filter((s) => countByStatus.has(s)).map((status) => ({
    status: STATUS_LABELS[status] ?? status,
    count: countByStatus.get(status) ?? 0,
  }));

  if (chartData.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No task data yet.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} width={28} fontSize={12} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
