"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// Ordinal severity scale -> a single sequential-style ramp (light to dark/warm),
// not arbitrary categorical hues, since priority has an inherent order.
const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "var(--chart-2)",
  MEDIUM: "var(--chart-4)",
  HIGH: "var(--chart-5)",
  CRITICAL: "var(--destructive)",
};

const chartConfig = {
  count: { label: "Tasks" },
} satisfies ChartConfig;

export function TasksByPriorityChart({ data }: { data: { priority: string; count: number }[] }) {
  const countByPriority = new Map(data.map((d) => [d.priority, d.count]));
  const chartData = PRIORITY_ORDER.filter((p) => countByPriority.has(p)).map((priority) => ({
    priority: PRIORITY_LABELS[priority] ?? priority,
    count: countByPriority.get(priority) ?? 0,
    fill: PRIORITY_COLORS[priority],
  }));

  if (chartData.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No task data yet.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="priority" tickLine={false} axisLine={false} width={70} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
