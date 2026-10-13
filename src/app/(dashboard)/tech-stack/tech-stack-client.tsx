"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TechBadge } from "@/components/projects/tech-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TECH_CATEGORY_LABELS, type TechCategory } from "@/lib/validations/project-tech";

interface TechGroup {
  name: string;
  category: TechCategory;
  projects: { id: string; name: string; status: string; version: string | null; purpose: string | null }[];
}

export function TechStackClient({ tech }: { tech: TechGroup[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TechCategory | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tech.filter(
      (t) =>
        (category === "ALL" || t.category === category) &&
        (!q || t.name.toLowerCase().includes(q) || t.projects.some((p) => p.name.toLowerCase().includes(q))),
    );
  }, [tech, query, category]);

  const presentCategories = (Object.keys(TECH_CATEGORY_LABELS) as TechCategory[]).filter((c) =>
    tech.some((t) => t.category === c),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tools &amp; Tech Stack</h1>
        <p className="text-sm text-muted-foreground">
          {tech.length} tools and technologies across your projects. Add them from a project&apos;s page.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search tools or projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tech stack"
          />
        </div>
        <Tabs value={category} onValueChange={(v) => setCategory(v as TechCategory | "ALL")} className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            {presentCategories.map((c) => (
              <TabsTrigger key={c} value={c}>
                {TECH_CATEGORY_LABELS[c]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tech.length === 0 ? "No tools or technologies recorded yet." : "Nothing matches your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.name.toLowerCase()}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <TechBadge name={t.name} category={t.category} />
                  <span className="text-xs text-muted-foreground">
                    {t.projects.length} project{t.projects.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {t.projects.map((p) => (
                    <li key={p.id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/projects/${p.id}`} className="truncate text-sm hover:underline">
                          {p.name}
                          {p.version && <span className="ml-1 text-xs text-muted-foreground">{p.version}</span>}
                        </Link>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.purpose && <p className="text-xs text-muted-foreground">{p.purpose}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
