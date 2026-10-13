import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  TODO: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  BLOCKED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  REVIEW: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  PLANNING: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  NOT_STARTED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  SCHEDULED: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  LIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  PENDING: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PLANNING: "Planning",
  NOT_STARTED: "Not Started",
  ON_HOLD: "On Hold",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  PENDING: "Pending",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status])}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
