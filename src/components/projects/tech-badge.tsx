import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TECH_CATEGORY_LABELS, type TechCategory } from "@/lib/validations/project-tech";

const CATEGORY_STYLES: Record<TechCategory, string> = {
  LANGUAGE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  FRAMEWORK: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  DATABASE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  INFRASTRUCTURE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  TOOL: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  SERVICE: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  OTHER: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export function TechBadge({
  name,
  category,
  version,
}: {
  name: string;
  category: TechCategory;
  version?: string | null;
}) {
  return (
    <Badge variant="outline" className={cn("font-normal", CATEGORY_STYLES[category])} title={TECH_CATEGORY_LABELS[category]}>
      {name}
      {version ? <span className="opacity-70">{version}</span> : null}
    </Badge>
  );
}
