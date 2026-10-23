import { z } from "zod";
import { TITLE_ID } from "../../domain/user";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => [...v].length <= max);
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z
  .string()
  .refine((v) => [...v].length >= 12 && [...v].length <= 128 && !v.includes("\0"));
const loginPassword = z.string().min(1).max(256);
export const registerSchema = z.strictObject({ email, password, displayName: text(100) });
export const loginSchema = z.strictObject({ email, password: loginPassword });
export const profileSchema = z
  .strictObject({
    displayName: text(100).optional(),
    avatarUrl: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          const u = new URL(value);
          return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
        } catch {
          return false;
        }
      })
      .nullable()
      .optional(),
    preferredLanguage: z
      .string()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export const changePasswordSchema = z.strictObject({
  currentPassword: loginPassword,
  newPassword: password,
});
export const preferenceSchema = z.strictObject({ value: z.enum(["LIKE", "DISLIKE"]) });
export const titleSchema = z.string().regex(TITLE_ID);
export const emptySchema = z.strictObject({});
const positive = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().safe());
export const paginationSchema = z.strictObject({
  page: positive.optional(),
  limit: positive.pipe(z.number().max(100)).optional(),
});
