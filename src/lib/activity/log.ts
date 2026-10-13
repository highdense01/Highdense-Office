import "server-only";
import { prisma } from "@/lib/db/prisma";
import { headers } from "next/headers";

export interface LogActivityInput {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Activity logs are insert-only and never exposed for editing/deleting via
 * the app (see prisma/schema.prisma ActivityLog — no update mutation exists
 * anywhere in server/actions). Best-effort: a logging failure must never
 * fail the business operation it's describing.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    try {
      const headerList = await headers();
      ipAddress = headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip");
      userAgent = headerList.get("user-agent");
    } catch {
      // headers() is unavailable outside a request scope (e.g. seed scripts) — that's fine.
    }

    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log", error);
  }
}
