/**
 * Database access for request handling.
 *
 * Every query on behalf of a signed-in user goes through `withUser`, which
 * opens a transaction, switches to the `wows_app` role and sets
 * `app.user_id` for the duration of that transaction. Row-level security
 * (drizzle/migrations/0001_roles_triggers_rls.sql) does the scoping (H2).
 *
 * Why `SET LOCAL` and the transaction pooler are compatible: Supavisor in
 * transaction mode pins one backend connection to a client for the whole
 * transaction, and `SET LOCAL` (and `set_config(..., true)`) is scoped to
 * that transaction, so nothing leaks to the next borrower. A session-level
 * `SET` would leak, which is why it is never used here. Prepared statements
 * are disabled because transaction mode cannot track them.
 *
 * The one path that bypasses RLS (seed, bootstrap, backup drill) lives in
 * src/db/system.ts and must never be imported from src/app.
 */
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { wowsDb?: Db };

function createDb(): Db {
  const e = env();
  const client = postgres(e.DATABASE_POOLER_URL ?? e.DATABASE_URL, {
    prepare: false,
    max: 10,
  });
  return drizzle(client, { schema });
}

/** Shared pooled connection. Do not query it directly from app code; use `withUser`. */
export function getDb(): Db {
  if (!globalForDb.wowsDb) globalForDb.wowsDb = createDb();
  return globalForDb.wowsDb;
}

/**
 * Runs `fn` inside a transaction scoped to `userId`, with RLS enforced.
 * Errors propagate: a failed write must surface to the user (H34).
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE wows_app`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/** Same as `withUser` but with no identity: every policy evaluates as a guest. */
export async function withGuest<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE wows_app`);
    await tx.execute(sql`SELECT set_config('app.user_id', '', true)`);
    return fn(tx);
  });
}
