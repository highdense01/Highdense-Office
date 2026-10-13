"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { changeMyPassword } from "@/server/actions/auth";

export function ChangePasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    setSubmitting(true);
    const result = await changeMyPassword(values);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(hasPassword ? "Password changed" : "Password set — you can now sign in with email and password");
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{hasPassword ? "Change Password" : "Set a Password"}</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Update the password used for email/password sign-in."
            : "Set a password to be able to sign in."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-3">
          <FieldGroup>
            {hasPassword && (
              <Field data-invalid={!!errors.currentPassword}>
                <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
                <PasswordInput id="currentPassword" {...register("currentPassword")} />
                <FieldError errors={[errors.currentPassword]} />
              </Field>
            )}
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
              <PasswordInput id="newPassword" {...register("newPassword")} />
              <FieldError errors={[errors.newPassword]} />
            </Field>
            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
              <PasswordInput id="confirmPassword" {...register("confirmPassword")} />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : hasPassword ? "Change Password" : "Set Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
