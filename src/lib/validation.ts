import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email();

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const signupSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});

export const adminSourceSchema = z.object({
  id: z.string().cuid().optional(),
  country: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(64),
  url: z.string().url(),
  active: z.boolean().optional().default(true),
});
