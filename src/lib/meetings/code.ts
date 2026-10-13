import { randomInt } from "node:crypto";

const LETTERS = "abcdefghijkmnpqrstuvwxyz"; // no "l" / "o": easy to misread when typed from a call

/** Meet-style join code, e.g. "kqx-mfdp-rtw" (10 letters, ~2^46 combinations). */
export function generateMeetingCode(): string {
  const pick = (n: number) => Array.from({ length: n }, () => LETTERS[randomInt(LETTERS.length)]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

/** Accepts "kqxmfdprtw", "KQX-MFDP-RTW", or a pasted /meetings/join?code=... style value. Returns null if malformed. */
export function normalizeMeetingCode(input: string): string | null {
  const letters = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (letters.length !== 10) return null;
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
}
