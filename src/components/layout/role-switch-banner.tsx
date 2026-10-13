"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noteLocalRoleChange } from "@/components/auth/session-sync";

/** Shown while the user is working as a different (lower) role than the one they were assigned. */
export function RoleSwitchBanner({ actingAs, ownRole }: { actingAs: string | null; ownRole: string | null }) {
  const { update } = useSession();
  const router = useRouter();
  const [returning, setReturning] = useState(false);

  async function handleReturn() {
    setReturning(true);
    noteLocalRoleChange();
    await update({ switchRoleId: null });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-sky-500/15 px-4 py-2 text-sm text-sky-700 dark:text-sky-400">
      <Repeat className="size-4" />
      <span>
        You&apos;re working as <strong>{actingAs ?? "another role"}</strong>. Your default role is{" "}
        <strong>{ownRole ?? "unassigned"}</strong>.
      </span>
      <Button size="sm" variant="outline" className="h-7" onClick={handleReturn} disabled={returning}>
        {returning && <Loader2 className="size-3.5 animate-spin" />}
        Switch back
      </Button>
    </div>
  );
}
