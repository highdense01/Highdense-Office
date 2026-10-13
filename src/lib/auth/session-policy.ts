/**
 * Idle-session policy, shared by the server (rejects stale tokens) and the
 * browser (idle timer + warning). NEXT_PUBLIC_ so both sides read one value.
 */
const configured = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES);

export const IDLE_TIMEOUT_MINUTES = Number.isFinite(configured) && configured >= 1 ? configured : 5;
export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const IDLE_TIMEOUT_SECONDS = IDLE_TIMEOUT_MINUTES * 60;

/** How long before sign-out the "still there?" warning appears. */
export const IDLE_WARNING_MS = Math.min(60_000, IDLE_TIMEOUT_MS / 2);

/** While the user is active, tell the server at most this often so the token stays fresh. */
export const ACTIVITY_PING_INTERVAL_MS = Math.max(15_000, Math.min(60_000, IDLE_TIMEOUT_MS / 4));

/** Window event the meeting room fires while a call is live (mouse movement inside the call iframe isn't visible to us). */
export const KEEP_ALIVE_EVENT = "hdo:keep-alive";
