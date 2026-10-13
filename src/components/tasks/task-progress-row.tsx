import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";

interface TaskProgressRowProps {
  id: string;
  title: string;
  projectName?: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate?: Date | string | null;
}

export function TaskProgressRow({ id, title, projectName, status, priority, progress, dueDate }: TaskProgressRowProps) {
  return (
    <Link href={`/tasks/${id}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {projectName && <p className="truncate text-xs text-muted-foreground">{projectName}</p>}
          <p className="truncate text-sm font-medium">{title}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <PriorityBadge priority={priority} />
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={progress} className="h-1.5" />
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      {dueDate && (
        <p className="mt-1.5 text-xs text-muted-foreground">Due {new Date(dueDate).toLocaleDateString()}</p>
      )}
    </Link>
  );
}
