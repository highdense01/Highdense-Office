"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TechBadge } from "@/components/projects/tech-badge";
import { addProjectTech, removeProjectTech } from "@/server/actions/project-hub";
import { TECH_CATEGORY_LABELS, type TechCategory } from "@/lib/validations/project-tech";

export interface TechRow {
  id: string;
  name: string;
  category: TechCategory;
  version: string | null;
  purpose: string | null;
  url: string | null;
}

const EMPTY = { name: "", category: "TOOL" as TechCategory, version: "", purpose: "", url: "" };

export function ProjectTechPanel({
  projectId,
  tech,
  canEdit,
}: {
  projectId: string;
  tech: TechRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addProjectTech({ projectId, ...form });
    setSubmitting(false);
    if (!result.success) return toast.error(result.fieldErrors?.url?.[0] ?? result.fieldErrors?.name?.[0] ?? result.error);
    toast.success(`${form.name} added`);
    setForm(EMPTY);
    setAdding(false);
    router.refresh();
  }

  async function handleRemove(row: TechRow) {
    const result = await removeProjectTech(row.id);
    if (!result.success) return toast.error(result.error);
    toast.success(`${row.name} removed`);
    router.refresh();
  }

  const byCategory = (Object.keys(TECH_CATEGORY_LABELS) as TechCategory[])
    .map((category) => ({ category, items: tech.filter((t) => t.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Tools &amp; Technologies ({tech.length})</h2>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add Tool / Tech
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                required
                placeholder="Name (e.g. PostgreSQL)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-label="Name"
              />
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TechCategory })}>
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TECH_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Version (optional)"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                aria-label="Version"
              />
              <Input
                type="url"
                placeholder="Link (optional)"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                aria-label="Link"
              />
              <Input
                className="sm:col-span-2 lg:col-span-4"
                placeholder="What is it used for in this project? (optional)"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                aria-label="Purpose"
              />
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Adding..." : "Add"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAdding(false);
                    setForm(EMPTY);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tech.length === 0 ? (
        <p className="rounded-md border py-10 text-center text-sm text-muted-foreground">
          No tools or technologies recorded for this project yet.
        </p>
      ) : (
        <div className="space-y-4">
          {byCategory.map(({ category, items }) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {TECH_CATEGORY_LABELS[category]}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0 space-y-1">
                      <TechBadge name={row.name} category={row.category} version={row.version} />
                      {row.purpose && <p className="text-xs text-muted-foreground">{row.purpose}</p>}
                      {row.url && (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          Docs
                        </a>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemove(row)}
                        aria-label={`Remove ${row.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
