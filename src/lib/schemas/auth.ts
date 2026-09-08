import { z } from "zod";

export const ALLOWED_EMAIL_DOMAIN = "ashoka.edu.in";

export const magicLinkRequestSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .transform((e) => e.trim().toLowerCase())
    .refine((e) => e.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`), {
      message: `Use your @${ALLOWED_EMAIL_DOMAIN} address.`,
    }),
});

export const confirmQuerySchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["magiclink", "email", "signup", "recovery", "invite"]),
  next: z
    .string()
    .default("/dashboard")
    .refine((n) => n.startsWith("/") && !n.startsWith("//"), {
      message: "next must be a local path",
    }),
});

export const grantRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["applicant", "member", "lead", "core", "faculty", "alum"]),
  seasonId: z.uuid().nullable().default(null),
});
