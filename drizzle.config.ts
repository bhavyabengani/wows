import { defineConfig } from "drizzle-kit";

/**
 * Drizzle owns the single, forward-only migration chain (CLAUDE.md).
 *
 *   npm run db:generate   diff src/db/schema.ts against the last snapshot and
 *                         write a new SQL migration under drizzle/migrations
 *   npm run db:migrate    apply pending migrations to DATABASE_URL
 *
 * Never edit an applied migration; never use the Supabase CLI for migrations.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Only manage what lives in src/db/schema.ts; roles, triggers and policies
  // are hand-written SQL migrations and must not be diffed away.
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
