"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { requestPasswordReset, resetPasswordWithOtp } from "@/server/actions/password-reset";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const result = await requestPasswordReset({ identifier });
    setBusy(false);
    if (!result.success) return setError(result.error);
    setStep("verify");
    toast.success("If that account exists, a code is on its way.");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    const result = await resetPasswordWithOtp({ identifier, code, newPassword, confirmPassword });
    setBusy(false);
    if (!result.success) {
      const field = result.fieldErrors && Object.values(result.fieldErrors).flat()[0];
      return setError(field ?? result.error);
    }
    toast.success("Password changed. Please sign in.");
    router.push("/login");
  }

  if (step === "request") {
    return (
      <form onSubmit={sendCode} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="fp-identifier" className="text-sm font-medium">
            Employee ID or email
          </label>
          <Input
            id="fp-identifier"
            autoFocus
            autoComplete="username"
            placeholder="EMP001"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !identifier.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Send code
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={reset} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code we e-mailed to the address on <strong>{identifier}</strong>. It expires in 10 minutes.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="fp-code" className="text-sm font-medium">
          Code
        </label>
        <Input
          id="fp-code"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="text-center font-mono text-lg tracking-[0.4em]"
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="fp-new" className="text-sm font-medium">
          New password
        </label>
        <PasswordInput
          id="fp-new"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="fp-confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <PasswordInput
          id="fp-confirm"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || !newPassword}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Reset password
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => sendCode()}
          disabled={busy}
          className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
