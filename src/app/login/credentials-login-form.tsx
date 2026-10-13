"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function CredentialsLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", {
      employeeId: values.employeeId,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);

    if (result?.error) {
      // Auth.js reports wrong credentials as "CredentialsSignin"; anything else is a server-side failure
      // (database down, misconfiguration), which must not be blamed on the user's password.
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid Employee ID or password."
          : "Sign-in failed because of a server problem, not your password. Try again or contact an administrator.",
      );
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <FieldGroup>
        <Field data-invalid={!!errors.employeeId}>
          <FieldLabel htmlFor="login-employee-id">Employee ID</FieldLabel>
          <Input id="login-employee-id" placeholder="EMP001" {...register("employeeId")} />
          <FieldError errors={[errors.employeeId]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <PasswordInput id="login-password" placeholder="••••••••" {...register("password")} />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="text-right">
        <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
