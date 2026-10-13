import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Upstash Redis is optional in local development (presence/rate-limiting
 * degrade gracefully to no-ops if not configured), but required in
 * production. MySQL remains the source of truth for all persistent data.
 */
export const redis = url && token ? new Redis({ url, token }) : null;

export const REDIS_KEYS = {
  presence: (userId: string) => `presence:${userId}`,
  unreadCount: (userId: string, threadId: string) => `unread:${userId}:${threadId}`,
  rateLimit: (bucket: string, key: string) => `ratelimit:${bucket}:${key}`,
  meetingLive: (meetingId: string) => `meeting:live:${meetingId}`,
  notificationBadge: (userId: string) => `notif:badge:${userId}`,
} as const;

const PRESENCE_TTL_SECONDS = 90;

export async function markUserOnline(userId: string) {
  if (!redis) return;
  await redis.set(REDIS_KEYS.presence(userId), Date.now(), { ex: PRESENCE_TTL_SECONDS });
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (!redis) return false;
  const value = await redis.get(REDIS_KEYS.presence(userId));
  return value !== null;
}

export async function getOnlineUserIds(userIds: string[]): Promise<Set<string>> {
  if (!redis || userIds.length === 0) return new Set();
  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.get(REDIS_KEYS.presence(id)));
  const results = await pipeline.exec<unknown[]>();
  const online = new Set<string>();
  results.forEach((value, index) => {
    if (value !== null) online.add(userIds[index]);
  });
  return online;
}

export async function incrementUnreadCount(userId: string, threadId: string) {
  if (!redis) return;
  await redis.incr(REDIS_KEYS.unreadCount(userId, threadId));
}

export async function resetUnreadCount(userId: string, threadId: string) {
  if (!redis) return;
  await redis.del(REDIS_KEYS.unreadCount(userId, threadId));
}

export async function getUnreadCount(userId: string, threadId: string): Promise<number> {
  if (!redis) return 0;
  const value = await redis.get<number>(REDIS_KEYS.unreadCount(userId, threadId));
  return value ?? 0;
}
