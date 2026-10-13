import { z } from "zod";

export const loginSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const setEmployeePasswordSchema = z.object({
  userId: z.string().min(1),
  password: passwordRules,
});
export type SetEmployeePasswordInput = z.infer<typeof setEmployeePasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const requestPasswordResetSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your Employee ID or email").max(150),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1).max(150),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
