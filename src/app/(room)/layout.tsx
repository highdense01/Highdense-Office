import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { IdleSessionManager } from "@/components/auth/idle-session-manager";

/** Full-screen shell for live meeting rooms: no sidebar/navbar, but still requires an active session. */
export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.accountStatus !== "ACTIVE") redirect("/login?error=AccountInactive");

  return (
    <main className="flex h-dvh flex-col bg-background">
      <IdleSessionManager />
      {children}
    </main>
  );
}
