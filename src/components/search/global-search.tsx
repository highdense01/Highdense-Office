"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, FolderKanban, CheckSquare, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { globalSearch, type SearchResult } from "@/server/actions/search";

const ICONS = {
  employee: User,
  project: FolderKanban,
  task: CheckSquare,
  meeting: Video,
} as const;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(async () => {
      const data = await globalSearch(query);
      setResults(data);
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search employees, projects, tasks, meetings..."
        className="h-9 pl-8"
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {results.map((result) => {
            const Icon = ICONS[result.type];
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  router.push(result.href);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{result.title}</span>
                {result.subtitle && <span className="text-xs text-muted-foreground">{result.subtitle}</span>}
              </button>
            );
          })}
        </div>
      )}
      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md">
          No results found.
        </div>
      )}
    </div>
  );
}
