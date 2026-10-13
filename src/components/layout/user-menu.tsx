"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, KeyRound, LogOut, Repeat, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listSwitchableRoles, type SwitchableRole } from "@/server/actions/role-switch";
import { noteLocalRoleChange } from "@/components/auth/session-sync";

interface UserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  roleName: string | null;
  /** Every role the user holds. */
  roleNames: string[];
  canSwitchRole: boolean;
}

export function UserMenu({ name, email, image, roleName, roleNames, canSwitchRole }: UserMenuProps) {
  const router = useRouter();
  const { update } = useSession();
  const [roles, setRoles] = useState<SwitchableRole[] | null>(null);
  const [switching, setSwitching] = useState(false);

  const initials = (name || email || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleOpenChange(open: boolean) {
    if (open && canSwitchRole) {
      listSwitchableRoles()
        .then(setRoles)
        .catch(() => setRoles([]));
    }
  }

  async function switchTo(role: SwitchableRole) {
    if (role.isCurrent || switching) return;
    setSwitching(true);
    noteLocalRoleChange(); // so the live-sync watcher doesn't announce our own switch as an admin change
    // The server re-validates this choice; switching back to the primary role clears it.
    const session = await update({ switchRoleId: role.isPrimary ? null : role.id });
    setSwitching(false);
    if (!session || session.user.roleId !== role.id) {
      toast.error("That role isn't available to you.");
      return;
    }
    toast.success(role.isPrimary ? `Back to ${role.name}` : `Now working as ${role.name}`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-7">
            <AvatarImage src={image ?? undefined} alt={name ?? "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          {(roleNames.length > 0 || roleName) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(roleNames.length > 0 ? roleNames : [roleName!]).map((r) => (
                <Badge key={r} variant={r === roleName ? "secondary" : "outline"} className="font-normal">
                  {r}
                </Badge>
              ))}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCircle className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile#password">
            <KeyRound className="size-4" />
            Change password
          </Link>
        </DropdownMenuItem>
        {canSwitchRole && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Repeat className="size-4" />
              Switch role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {roles === null ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading...</p>
              ) : roles.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No other roles available.</p>
              ) : (
                <>
                  {(["assigned", "preview"] as const).map((kind) => {
                    const group = roles.filter((r) => r.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <div key={kind}>
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                          {kind === "assigned" ? "My roles" : "Preview a lower role"}
                        </DropdownMenuLabel>
                        {group.map((role) => (
                          <DropdownMenuItem key={role.id} disabled={switching} onSelect={() => switchTo(role)}>
                            <span className="flex-1 truncate">
                              {role.name}
                              {role.isPrimary && <span className="ml-1 text-xs text-muted-foreground">(default)</span>}
                            </span>
                            {role.isCurrent && <Check className="size-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
