import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CredentialsLoginForm } from "./credentials-login-form";
import { Building2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  AccountInactive: "Your account is inactive or suspended. Contact an administrator.",
  Configuration: "Sign-in is not configured correctly. Contact an administrator.",
  Default: "Something went wrong while signing in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reason?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl || "/dashboard");

  const idleMessage =
    params.reason === "idle" ? "You were signed out because of inactivity. Please sign in again." : null;
  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.Default) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <CardTitle className="text-xl">High Dense Office</CardTitle>
          <CardDescription>Sign in with your company account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {idleMessage && !errorMessage && (
            <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground" role="status">
              {idleMessage}
            </p>
          )}
          {errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <CredentialsLoginForm callbackUrl={params.callbackUrl || "/dashboard"} />

          <p className="text-center text-xs text-muted-foreground">
            Access is provisioned by your administrator. If you don&apos;t have an account yet, contact HR/IT.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
