import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  CRITICAL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal capitalize", PRIORITY_STYLES[priority])}>
      {priority.toLowerCase()}
    </Badge>
  );
}
