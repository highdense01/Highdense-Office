"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 15_000;
const LOCAL_CHANGE_WINDOW_MS = 10_000;

let localChangeUntil = 0;

/** Call right before the user switches their OWN role, so that change isn't announced as an admin change. */
export function noteLocalRoleChange() {
  localChangeUntil = Date.now() + LOCAL_CHANGE_WINDOW_MS;
}

/**
 * Keeps an open session in step with the database. Every POLL_INTERVAL the session is re-read from the
 * server (a no-data update: it refreshes the role/permissions but does NOT count as user activity, so it
 * can't hold off the idle timeout). If the effective role or permissions changed because an admin edited
 * them, the user is told and sent to the dashboard for their new role instead of seeing stale screens.
 */
export function SessionSyncWatcher() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void update({});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [update]);

  const user = session?.user;
  const signature = user
    ? [user.roleId, user.isAdmin, user.isActingAs, [...user.permissions].sort().join(",")].join("|")
    : null;

  useEffect(() => {
    if (status !== "authenticated" || !signature) return;

    const previous = lastSignature.current;
    lastSignature.current = signature;
    if (previous === null || previous === signature) return;

    if (Date.now() < localChangeUntil) return; // the user switched role themselves

    toast.info(`Your access was updated${user?.roleName ? `. You're now working as ${user.roleName}.` : "."}`);
    router.push("/dashboard");
    router.refresh();
  }, [status, signature, user?.roleName, router]);

  return null;
}
