import { z } from 'zod';

// Mirrors RegisterRequest, LoginRequest and RefreshRequest in openapi.yaml.
// strictObject = unknown fields are rejected, like `additionalProperties: false` in the contract.

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.strictObject({
  email,
  password: z
    .string()
    .min(8)
    // bcrypt only uses the first 72 BYTES: "ñ" or an emoji take more than one byte each.
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Must be at most 72 bytes long'),
  name: z.string().trim().min(1).max(100),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1),
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
