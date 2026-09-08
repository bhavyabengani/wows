/**
 * Environment variables, parsed once with Zod (CLAUDE.md > Conventions:
 * "Zod at every API boundary" — the environment is a boundary).
 *
 * `env()` is server-only: it reads secrets. `publicEnv` is safe for the
 * browser and is inlined by Next.js at build time, which is why each
 * NEXT_PUBLIC_ variable is referenced by its full literal name.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const serverSchema = publicSchema.extend({
  /** Direct or session-mode connection: migrations, seed, backups, tests. */
  DATABASE_URL: z.string().min(1),
  /** Transaction-mode pooler for the app at runtime. Falls back to DATABASE_URL. */
  DATABASE_POOLER_URL: z.string().min(1).optional(),
  /** Supabase secret key: Auth admin API only (seed, bootstrap). Never in the browser. */
  SUPABASE_SECRET_KEY: z.string().min(1),
  /** Local mail catcher used by the login end-to-end test. */
  MAILPIT_URL: z.url().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

let cachedPublic: PublicEnv | undefined;

/**
 * Browser-safe environment. Parsed lazily so that a deployment without
 * Supabase configured (public pages only) still builds and serves; the
 * first auth-dependent request then fails with a readable message.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  if (!parsed.success) throw new EnvError(parsed.error.issues);
  cachedPublic = parsed.data;
  return cachedPublic;
}

export class EnvError extends Error {
  constructor(issues: z.core.$ZodIssue[]) {
    const detail = issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    super(`Invalid environment: ${detail}. See .env.example.`);
    this.name = "EnvError";
  }
}

let cached: ServerEnv | undefined;

/** Server-side environment. Throws with a readable message when misconfigured. */
export function env(): ServerEnv {
  if (cached) return cached;
  if (typeof window !== "undefined") {
    throw new Error("env() is server-only; use publicEnv in the browser");
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new EnvError(parsed.error.issues);
  cached = parsed.data;
  return cached;
}
