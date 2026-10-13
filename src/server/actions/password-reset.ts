"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity/log";
import { hashPassword } from "@/lib/auth/password";
import { sendMail } from "@/lib/email/mailer";
import { checkRateLimit, otpLimiter } from "@/lib/redis/rate-limit";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import type { ActionResult } from "./employees";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;

const GENERIC_ERROR = "That code is invalid or has expired. Request a new one.";

function hashCode(userId: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`pwreset:${userId}:${code}`).digest("hex");
}

async function clientKey(identifier: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return `${identifier.toLowerCase()}:${ip}`;
}

/** Employee ID or e-mail, case-insensitive on the e-mail. Inactive / deleted accounts cannot reset. */
async function findResettableUser(identifier: string) {
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      accountStatus: "ACTIVE",
      OR: [{ employeeId: identifier }, { email: identifier.toLowerCase() }],
    },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Step 1: e-mail a 6-digit code to the address on file. The response is identical whether or not the account
 * exists, so this can't be used to discover who has an account.
 */
export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { identifier } = parsed.data;

  const limit = await checkRateLimit(otpLimiter, await clientKey(identifier));
  if (!limit.success) return { success: false, error: "Too many attempts. Please wait a few minutes and try again." };

  const user = await findResettableUser(identifier);
  if (user) {
    const now = Date.now();
    const recent = await prisma.passwordResetOtp.findMany({
      where: { userId: user.id, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Cooldown and hourly cap also bound how many guesses an attacker gets when Redis limiting is off.
    const inCooldown = recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS;
    if (!inCooldown && recent.length < MAX_CODES_PER_HOUR) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      // Older codes stay (verification only ever checks the newest, and they feed the hourly cap above);
      // just prune rows too old to matter for either.
      await prisma.passwordResetOtp.deleteMany({
        where: { userId: user.id, createdAt: { lt: new Date(now - 2 * 60 * 60 * 1000) } },
      });
      await prisma.passwordResetOtp.create({
        data: { userId: user.id, codeHash: hashCode(user.id, code), expiresAt: new Date(now + OTP_TTL_MS) },
      });

      const sent = await sendMail({
        to: user.email,
        subject: "Your High Dense Office password reset code",
        text:
          `Hi ${user.name},\n\nYour password reset code is: ${code}\n\n` +
          `It expires in 10 minutes. If you didn't ask for this, you can ignore this e-mail; your password is unchanged.`,
        html:
          `<p>Hi ${escapeHtml(user.name)},</p><p>Your password reset code is:</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
          `<p>It expires in 10 minutes. If you didn't ask for this, you can ignore this e-mail; your password is unchanged.</p>`,
      });
      if (!sent) console.error(`[password-reset] could not e-mail a code to user ${user.id}`);
    }
  }

  return { success: true, data: undefined };
}

/** Step 2: check the code and set the new password. */
export async function resetPasswordWithOtp(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { identifier, code, newPassword } = parsed.data;

  const limit = await checkRateLimit(otpLimiter, await clientKey(`verify:${identifier}`));
  if (!limit.success) return { success: false, error: "Too many attempts. Please wait a few minutes and try again." };

  const user = await findResettableUser(identifier);
  if (!user) return { success: false, error: GENERIC_ERROR };

  const otp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { success: false, error: GENERIC_ERROR };

  if (otp.attempts >= MAX_ATTEMPTS_PER_CODE) {
    await prisma.passwordResetOtp.delete({ where: { id: otp.id } });
    return { success: false, error: "Too many wrong codes. Request a new one." };
  }
  // Count the attempt before comparing, so a failed check can't be retried for free.
  await prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });

  const expected = Buffer.from(otp.codeHash, "hex");
  const actual = Buffer.from(hashCode(user.id, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { success: false, error: GENERIC_ERROR };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetOtp.deleteMany({ where: { userId: user.id } }),
  ]);

  await logActivity({
    userId: user.id,
    action: "user.password_reset",
    entityType: "User",
    entityId: user.id,
    description: `${user.name} reset their password using an e-mailed code`,
  });

  return { success: true, data: undefined };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
