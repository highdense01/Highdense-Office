/**
 * Jitsi Meet helpers. Kept isolated behind this module so the meeting
 * provider can be swapped later (spec section 22) without touching
 * callers — they only ever see `meetingLink`.
 */
const JITSI_BASE_URL = process.env.NEXT_PUBLIC_JITSI_BASE_URL ?? "https://meet.jit.si";

export function generateMeetingLink(meetingTitle: string, meetingId: string): string {
  const slug = meetingTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const room = `hwms-${slug}-${meetingId}`.slice(0, 100);
  return `${JITSI_BASE_URL}/${room}`;
}

/** Link for a meeting that has a join code. The code is the unguessable part of the room name. */
export function generateMeetingLinkFromCode(code: string): string {
  return `${JITSI_BASE_URL}/hwms-${code.replace(/-/g, "")}`;
}

/** Splits a stored meetingLink into the Jitsi domain and room name the embedded player needs. */
export function parseMeetingLink(meetingLink: string): { domain: string; roomName: string } | null {
  try {
    const url = new URL(meetingLink);
    const roomName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!roomName) return null;
    return { domain: url.host, roomName };
  } catch {
    return null;
  }
}
