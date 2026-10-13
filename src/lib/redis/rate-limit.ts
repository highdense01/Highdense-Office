import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./client";

/**
 * Sliding-window rate limiters backed by Upstash Redis. When Redis is not
 * configured (e.g. local dev without an Upstash account) limiting is
 * disabled rather than blocking requests, since Redis here is a temporary
 * cache layer, not the source of truth.
 */
function buildLimiter(tokens: number, windowSeconds: number, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, `${windowSeconds} s`),
    prefix,
  });
}

export const chatMessageLimiter = buildLimiter(20, 10, "ratelimit:chat");
export const authLimiter = buildLimiter(10, 60, "ratelimit:auth");
export const otpLimiter = buildLimiter(5, 600, "ratelimit:otp");
export const apiLimiter = buildLimiter(60, 60, "ratelimit:api");

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ success: boolean; remaining: number }> {
  if (!limiter) return { success: true, remaining: Infinity };
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
