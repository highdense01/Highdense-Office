"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ACTIVITY_PING_INTERVAL_MS,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  KEEP_ALIVE_EVENT,
} from "@/lib/auth/session-policy";

const STORAGE_KEY = "hdo:last-activity";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
const LOGIN_URL = "/login?reason=idle";

function readShared(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Signs the user out after IDLE_TIMEOUT of no activity. Mounted inside every authenticated layout.
 *
 * - Activity is shared across tabs (localStorage), so working in one tab keeps the others alive.
 * - Real activity is reported to the server ("touch") at most every ACTIVITY_PING_INTERVAL_MS. The server
 *   enforces the same timeout on its own, so this timer is the friendly layer, not the only one.
 * - A warning with a countdown appears before sign-out; it must be dismissed explicitly (mouse movement
 *   alone doesn't cancel it).
 */
export function IdleSessionManager() {
  const router = useRouter();
  const { status, update } = useSession();

  const lastActivityRef = useRef(0);
  const lastPingRef = useRef(0);
  const warningOpenRef = useRef(false);
  const signingOutRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const ping = useCallback(() => {
    lastPingRef.current = Date.now();
    void update({ touch: true });
  }, [update]);

  const markActive = useCallback(
    (force = false) => {
      if (warningOpenRef.current && !force) return;
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        /* storage unavailable (private mode): per-tab tracking still works */
      }
      if (now - lastPingRef.current >= ACTIVITY_PING_INTERVAL_MS) ping();
    },
    [ping],
  );

  const endSession = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    void signOut({ callbackUrl: LOGIN_URL });
  }, []);

  useEffect(() => {
    lastPingRef.current = Date.now(); // the page load just authenticated; no ping needed yet
    markActive(true);

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 1000) return; // these events fire constantly; once a second is plenty
      lastWrite = now;
      markActive();
    };
    const onKeepAlive = () => markActive(true);

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    window.addEventListener(KEEP_ALIVE_EVENT, onKeepAlive);

    const tick = window.setInterval(() => {
      const idleFor = Date.now() - Math.max(lastActivityRef.current, readShared());
      if (idleFor >= IDLE_TIMEOUT_MS) {
        warningOpenRef.current = false;
        setSecondsLeft(null);
        endSession();
        return;
      }
      const remaining = IDLE_TIMEOUT_MS - idleFor;
      if (remaining <= IDLE_WARNING_MS) {
        warningOpenRef.current = true;
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningOpenRef.current) {
        // Another tab was used, so we're no longer close to the limit.
        warningOpenRef.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      window.removeEventListener(KEEP_ALIVE_EVENT, onKeepAlive);
      window.clearInterval(tick);
    };
  }, [markActive, endSession]);

  // The server dropped the session (e.g. it expired while this tab was in the background).
  useEffect(() => {
    if (status === "unauthenticated" && !signingOutRef.current) {
      signingOutRef.current = true;
      router.replace(LOGIN_URL);
    }
  }, [status, router]);

  function stay() {
    warningOpenRef.current = false;
    setSecondsLeft(null);
    lastPingRef.current = Date.now(); // the page load just authenticated; no ping needed yet
    markActive(true);
    ping();
  }

  return (
    <AlertDialog open={secondsLeft !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For your security you&apos;ll be signed out in <strong>{secondsLeft}s</strong> because there&apos;s been no
            activity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={endSession}>Sign out now</AlertDialogCancel>
          <AlertDialogAction onClick={stay}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
