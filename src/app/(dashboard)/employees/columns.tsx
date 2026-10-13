"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown, LogIn } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmployeeRow } from "./employee-form-dialog";

export function buildEmployeeColumns(opts: {
  canEdit: boolean;
  canDeactivate: boolean;
  canImpersonate: boolean;
  currentUserId: string;
  /** Hierarchy: false for employees at or above the viewer's level (they can't be edited or deactivated). */
  canManage: (employee: EmployeeRow) => boolean;
  onEdit: (employee: EmployeeRow) => void;
  onDeactivate: (id: string) => void;
  onImpersonate: (employee: EmployeeRow) => void;
}): ColumnDef<EmployeeRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Employee
          <ArrowUpDown className="ml-1 size-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const employee = row.original;
        const initials = employee.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <Link href={`/employees/${employee.id}`} className="flex items-center gap-2.5 hover:underline">
            <Avatar className="size-8">
              <AvatarImage src={employee.image ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{employee.name}</p>
              <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "employeeId",
      header: "Employee ID",
      cell: ({ row }) => row.original.employeeId ?? "—",
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.department?.name ?? "—",
    },
    {
      id: "designation",
      header: "Designation",
      accessorFn: (row) => row.designation?.name ?? "—",
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const { role, userRoles } = row.original;
        if (!role) return "—";
        const extras = userRoles ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary">{role.name}</Badge>
            {extras.length > 0 && (
              <Badge variant="outline" title={`Also holds: ${extras.map((ur) => ur.role.name).join(", ")}`}>
                +{extras.length}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "accountStatus",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.accountStatus;
        return (
          <Badge
            variant="outline"
            className={
              status === "ACTIVE"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-gray-500/20 bg-gray-500/10 text-gray-500"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    ...(opts.canImpersonate
      ? [
          {
            id: "impersonate",
            header: "",
            cell: ({ row }: { row: { original: EmployeeRow } }) => {
              const employee = row.original;
              const canImpersonateThisRow = employee.id !== opts.currentUserId && employee.accountStatus === "ACTIVE";
              if (!canImpersonateThisRow) return null;
              return (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => opts.onImpersonate(employee)}>
                  <LogIn className="size-3.5" />
                  Login
                </Button>
              );
            },
          } satisfies ColumnDef<EmployeeRow>,
        ]
      : []),
    {
      id: "actions",
      cell: ({ row }) => {
        const employee = row.original;
        if (!opts.canEdit && !opts.canDeactivate) return null;
        if (!opts.canManage(employee)) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {opts.canEdit && <DropdownMenuItem onClick={() => opts.onEdit(employee)}>Edit</DropdownMenuItem>}
              {opts.canDeactivate && employee.id !== opts.currentUserId && employee.accountStatus === "ACTIVE" && (
                <DropdownMenuItem variant="destructive" onClick={() => opts.onDeactivate(employee.id)}>
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
