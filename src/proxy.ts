import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Edge-runtime gate: redirects unauthenticated users to /login.
 * This does NOT check fine-grained permissions (Prisma cannot run on the
 * Edge runtime) — every page and server action still calls
 * requirePermission()/requireAuth() server-side. This middleware only
 * prevents anonymous access to the app shell.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico";

  if (isPublicPath) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
