"use client";

import { useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActivityLogs, type ActivityLogFilters } from "@/server/actions/activity-logs";
import type { ActivityLog, User } from "@prisma/client";

type LogRow = ActivityLog & { user: Pick<User, "id" | "name" | "email" | "employeeId"> | null };

export function ActivityLogsClient({
  initialLogs,
  initialTotalPages,
  actions,
}: {
  initialLogs: LogRow[];
  initialTotalPages: number;
  actions: string[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const filters: ActivityLogFilters = { page, search: search || undefined, action: action || undefined };
      startTransition(async () => {
        const result = await getActivityLogs(filters);
        setLogs(result.logs);
        setTotalPages(result.totalPages);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, action, page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">Immutable audit history of important actions across the system.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search description..."
            className="pl-8"
          />
        </div>
        <Select
          value={action || "all"}
          onValueChange={(v) => {
            setPage(1);
            setAction(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {isPending ? "Loading..." : "No activity found."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{log.user?.name ?? "System"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="max-w-md truncate">{log.description}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {log.entityType}
                      {log.entityId ? ` #${log.entityId.slice(0, 6)}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {Math.max(1, totalPages)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
