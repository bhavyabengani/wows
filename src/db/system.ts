/**
 * Privileged database access that BYPASSES row-level security.
 *
 * Only for: migrations tooling, `npm run db:seed`, the one-off production
 * bootstrap, the backup drill, and tests that need to arrange fixtures.
 * Never import this from src/app (guarded by src/lib/repo-invariants.test.ts).
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type SystemDb = PostgresJsDatabase<typeof schema>;

export function createSystemDb(): {
  db: SystemDb;
  close: () => Promise<void>;
} {
  const client = postgres(env().DATABASE_URL, { max: 4, prepare: false });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}
