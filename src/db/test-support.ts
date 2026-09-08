/**
 * Fixture helpers for database-level tests. Uses the privileged system
 * connection to ARRANGE data; the assertions themselves go through
 * `withUser` so RLS is exercised exactly as in production.
 */
import { randomUUID } from "node:crypto";
import { createSystemDb, type SystemDb } from "./system";
import * as s from "./schema";

export interface Fixture {
  db: SystemDb;
  close: () => Promise<void>;
  tag: string;
  season: typeof s.seasons.$inferSelect;
  instrument: typeof s.instruments.$inferSelect;
  users: {
    memberA: typeof s.users.$inferSelect;
    memberB: typeof s.users.$inferSelect;
    core: typeof s.users.$inferSelect;
    faculty: typeof s.users.$inferSelect;
  };
}

export async function createFixture(): Promise<Fixture> {
  const { db, close } = createSystemDb();
  const tag = randomUUID().slice(0, 8);

  const [season] = await db
    .insert(s.seasons)
    .values({
      name: `Test season ${tag}`,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-06-01T00:00:00Z"),
      state: "draft",
    })
    .returning();
  if (!season) throw new Error("season fixture");
  await db
    .update(s.seasons)
    .set({ state: "open" })
    .where(eqId(s.seasons.id, season.id));

  const [instrument] = await db
    .insert(s.instruments)
    .values({
      symbol: `TST${tag}`.toUpperCase(),
      name: `Test ${tag}`,
      assetClass: "equity",
    })
    .returning();
  if (!instrument) throw new Error("instrument fixture");

  const mk = async (label: string) => {
    const [u] = await db
      .insert(s.users)
      .values({
        authIdentity: randomUUID(),
        email: `${label}.${tag}@ashoka.edu.in`,
        displayName: `${label} ${tag}`,
      })
      .returning();
    if (!u) throw new Error(`user fixture ${label}`);
    return u;
  };
  const memberA = await mk("membera");
  const memberB = await mk("memberb");
  const core = await mk("core");
  const faculty = await mk("faculty");

  await db.insert(s.userRoles).values([
    { userId: memberA.id, role: "member", seasonId: season.id },
    { userId: memberB.id, role: "member", seasonId: season.id },
    { userId: core.id, role: "core", seasonId: null },
    { userId: core.id, role: "member", seasonId: season.id },
    { userId: faculty.id, role: "faculty", seasonId: null },
  ]);

  return {
    db,
    close,
    tag,
    season,
    instrument,
    users: { memberA, memberB, core, faculty },
  };
}

import { eq, type Column } from "drizzle-orm";
function eqId(column: Column, value: string) {
  return eq(column, value);
}

import { expect } from "vitest";
import { errorChainMessage } from "@/lib/errors";

/**
 * Asserts that a database call rejects with a message matching `pattern`
 * anywhere in its cause chain. Drizzle wraps driver errors as
 * "Failed query: ..." and keeps the Postgres message in `cause`.
 */
export async function rejects(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  let caught: unknown = undefined;
  let threw = false;
  try {
    await promise;
  } catch (error) {
    threw = true;
    caught = error;
  }
  if (!threw) throw new Error(`expected a rejection matching ${pattern}`);
  expect(errorChainMessage(caught)).toMatch(pattern);
}
