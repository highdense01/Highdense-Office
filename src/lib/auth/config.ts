import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { loadAuthUserContext } from "./get-user-context";
import { verifyPassword } from "./password";
import { loginSchema } from "@/lib/validations/auth";
import { checkRateLimit, authLimiter } from "@/lib/redis/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { IDLE_TIMEOUT_MS, IDLE_TIMEOUT_SECONDS } from "./session-policy";

const PERMISSIONS_MAX_AGE_SECONDS = 30;

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // The cookie is re-issued on every authenticated request, so maxAge is a rolling idle window. Background
  // requests (polling) can keep that alive, which is why the jwt callback ALSO enforces `lastActivityAt`,
  // which only real user activity advances.
  session: { strategy: "jwt", maxAge: IDLE_TIMEOUT_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Employee ID & Password",
      credentials: {
        employeeId: { label: "Employee ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { employeeId, password } = parsed.data;

        const { success } = await checkRateLimit(authLimiter, `login:${employeeId}`);
        if (!success) return null;

        const user = await prisma.user.findUnique({ where: { employeeId, deletedAt: null } });
        if (!user || !user.passwordHash) return null;
        if (user.accountStatus !== "ACTIVE") return null;

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      const now = Date.now();

      // Idle timeout: returning null destroys the session. Only a "touch" (real user activity, sent by the
      // browser) or a fresh sign-in moves lastActivityAt, so tabs left open can't keep a session alive.
      if (trigger !== "signIn" && token.lastActivityAt && now - token.lastActivityAt > IDLE_TIMEOUT_MS) {
        return null;
      }
      if (trigger === "signIn" || !token.lastActivityAt) token.lastActivityAt = now;

      if (trigger === "update" && updateData) {
        const data = updateData as {
          impersonateUserId?: string;
          touch?: boolean;
          switchRoleId?: string | null;
        };

        if (data.touch || data.switchRoleId !== undefined || data.impersonateUserId) {
          token.lastActivityAt = now;
        }

        // Role switch. The choice is validated in loadAuthUserContext on every refresh. It also works inside an
        // impersonated session, where it applies to the impersonated user's own roles.
        if (data.switchRoleId !== undefined) {
          token.actingRoleId = data.switchRoleId || null;
          token.permissionsSyncedAt = 0;
        }

        if (data.impersonateUserId && token.isAdmin && !token.impersonatorId) {
          const target = await prisma.user.findUnique({
            where: { id: data.impersonateUserId, deletedAt: null },
            select: { id: true, accountStatus: true },
          });
          if (target && target.accountStatus === "ACTIVE" && target.id !== token.userId) {
            await logActivity({
              userId: token.userId,
              action: "auth.impersonate_start",
              entityType: "User",
              entityId: target.id,
              description: `${token.employeeId ?? token.userId} started viewing the account as this user`,
            });
            token.impersonatorId = token.userId;
            token.userId = target.id;
            token.actingRoleId = null;
            token.permissionsSyncedAt = 0;
          }
        }
      }

      const userId = user?.id ?? token.userId;
      if (!userId) return token;

      const shouldRefresh =
        trigger === "signIn" ||
        trigger === "update" ||
        !token.permissionsSyncedAt ||
        Date.now() - token.permissionsSyncedAt > PERMISSIONS_MAX_AGE_SECONDS * 1000;

      if (shouldRefresh) {
        // Auth.js clears the session cookie (signing the user out) if this callback throws. So a hiccup while
        // re-reading roles (database restarting, schema mid-migration) must not log everyone out: keep the
        // current token and retry on the next request. A failed *sign-in* still fails loudly.
        let context: Awaited<ReturnType<typeof loadAuthUserContext>> = null;
        let refreshFailed = false;
        try {
          context = await loadAuthUserContext(userId, token.actingRoleId);
        } catch (err) {
          if (trigger === "signIn" || !token.permissionsSyncedAt) throw err;
          console.error("[auth] could not refresh session roles; keeping the existing token", err);
          refreshFailed = true;
        }

        // The account was deleted: end the session instead of letting it live on.
        if (!context && !refreshFailed && trigger !== "signIn") return null;

        if (context) {
          if (context.actingRoleRejected || !context.isActingAs) token.actingRoleId = null;
          if (
            trigger === "update" &&
            !context.actingRoleRejected &&
            (updateData as { switchRoleId?: unknown } | undefined)?.switchRoleId !== undefined
          ) {
            await logActivity({
              userId: context.userId,
              action: "auth.role_switch",
              entityType: "User",
              entityId: context.userId,
              description: context.isActingAs
                ? `Switched to acting as role "${context.roleName}"`
                : `Returned to own role "${context.roleName}"`,
            });
          }
          token.userId = context.userId;
          token.employeeId = context.employeeId;
          token.roleId = context.roleId;
          token.roleName = context.roleName;
          token.roleLevel = context.roleLevel ?? 0; // older cached contexts predate role levels
          token.realRoleId = context.realRoleId ?? context.roleId;
          token.realRoleName = context.realRoleName ?? context.roleName;
          token.realRoleLevel = context.realRoleLevel ?? context.roleLevel ?? 0;
          token.realIsAdmin = context.realIsAdmin ?? context.isAdmin;
          token.canSwitchRole = context.canSwitchRole ?? false;
          token.assignedRoleNames = context.assignedRoleNames ?? (context.roleName ? [context.roleName] : []);
          token.permissions = context.permissions;
          token.isAdmin = context.isAdmin;
          token.accountStatus = context.accountStatus;
          token.departmentId = context.departmentId;
          token.permissionsSyncedAt = Date.now();
        }
      }

      if (trigger === "signIn") {
        await logActivity({
          userId,
          action: "auth.sign_in",
          entityType: "User",
          entityId: userId,
          description: "User signed in via Employee ID and password",
        });
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.employeeId = token.employeeId;
      session.user.roleId = token.roleId;
      session.user.roleName = token.roleName;
      session.user.roleLevel = token.roleLevel ?? 0;
      session.user.realRoleId = token.realRoleId ?? token.roleId;
      session.user.realRoleName = token.realRoleName ?? token.roleName;
      session.user.realRoleLevel = token.realRoleLevel ?? token.roleLevel ?? 0;
      session.user.realIsAdmin = token.realIsAdmin ?? token.isAdmin ?? false;
      session.user.isActingAs = Boolean(token.actingRoleId);
      session.user.canSwitchRole = token.canSwitchRole ?? false;
      session.user.assignedRoleNames = token.assignedRoleNames ?? (token.roleName ? [token.roleName] : []);
      session.user.permissions = token.permissions ?? [];
      session.user.isAdmin = token.isAdmin ?? false;
      session.user.accountStatus = token.accountStatus ?? "ACTIVE";
      session.user.departmentId = token.departmentId;
      session.user.isImpersonating = Boolean(token.impersonatorId);
      return session;
    },
  },
};
