/**
 * H2 — row-level security is the gate, on its own.
 *
 * These tests deliberately bypass `requireRole` and every application
 * check: they open a transaction as member A through `withUser` (which only
 * sets the role and app.user_id) and query member B's rows by primary key.
 * If any of these return a row, the database is not protecting members.
 */
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withGuest, withUser } from "./client";
import * as s from "./schema";
import { createFixture, rejects, type Fixture } from "./test-support";

let f: Fixture;
let positionB: string;
let forecastB: string;
let draftNoteB: string;
let questionId: string;

beforeAll(async () => {
  f = await createFixture();
  const { db, season, instrument, users } = f;

  const [pos] = await db
    .insert(s.positions)
    .values({
      seasonId: season.id,
      userId: users.memberB.id,
      instrumentId: instrument.id,
    })
    .returning();
  positionB = pos!.id;
  await db.insert(s.theses).values({
    positionId: positionB,
    body: "B's thesis body",
    keyRisk: "B's key risk",
    falsifier: "B's falsifier",
  });

  const [q] = await db
    .insert(s.forecastQuestions)
    .values({
      seasonId: season.id,
      prompt: `Unresolved question ${f.tag}`,
      resolutionCriteria: "n/a",
      closesAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  questionId = q!.id;
  const [fc] = await db
    .insert(s.forecasts)
    .values({
      questionId,
      userId: users.memberB.id,
      probability: "0.7000",
      rationale: "B's private rationale",
    })
    .returning();
  forecastB = fc!.id;

  const [note] = await db
    .insert(s.researchNotes)
    .values({
      authorId: users.memberB.id,
      seasonId: season.id,
      title: `Draft ${f.tag}`,
      slug: `draft-${f.tag}`,
      bodyMd: "B's private draft",
      state: "draft",
    })
    .returning();
  draftNoteB = note!.id;
});

afterAll(async () => {
  await f.close();
});

describe("H2: member A cannot read member B's private rows by ID", () => {
  it("open position: hidden from A, visible to B, visible to staff", async () => {
    const asA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.positions)
        .where(sql`${s.positions.id} = ${positionB}`),
    );
    expect(asA).toEqual([]);

    const asB = await withUser(f.users.memberB.id, (tx) =>
      tx
        .select()
        .from(s.positions)
        .where(sql`${s.positions.id} = ${positionB}`),
    );
    expect(asB).toHaveLength(1);

    const asFaculty = await withUser(f.users.faculty.id, (tx) =>
      tx
        .select()
        .from(s.positions)
        .where(sql`${s.positions.id} = ${positionB}`),
    );
    expect(asFaculty).toHaveLength(1);
  });

  it("thesis on an open position: hidden from A", async () => {
    const asA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.theses)
        .where(sql`${s.theses.positionId} = ${positionB}`),
    );
    expect(asA).toEqual([]);
  });

  it("unresolved forecast: hidden from A, visible to B", async () => {
    const asA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.forecasts)
        .where(sql`${s.forecasts.id} = ${forecastB}`),
    );
    expect(asA).toEqual([]);
    const asB = await withUser(f.users.memberB.id, (tx) =>
      tx
        .select()
        .from(s.forecasts)
        .where(sql`${s.forecasts.id} = ${forecastB}`),
    );
    expect(asB).toHaveLength(1);
  });

  it("draft research note: hidden from A, visible to B and to staff", async () => {
    const asA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.researchNotes)
        .where(sql`${s.researchNotes.id} = ${draftNoteB}`),
    );
    expect(asA).toEqual([]);
    const asCore = await withUser(f.users.core.id, (tx) =>
      tx
        .select()
        .from(s.researchNotes)
        .where(sql`${s.researchNotes.id} = ${draftNoteB}`),
    );
    expect(asCore).toHaveLength(1);
  });

  it("a guest (no identity) sees nothing at all", async () => {
    const rows = await withGuest((tx) => tx.select().from(s.positions));
    expect(rows).toEqual([]);
  });

  it("the row really exists (the system path sees it)", async () => {
    const rows = await f.db
      .select()
      .from(s.positions)
      .where(sql`${s.positions.id} = ${positionB}`);
    expect(rows).toHaveLength(1);
  });

  it("A cannot write a forecast in B's name", async () => {
    await rejects(
      withUser(f.users.memberA.id, (tx) =>
        tx.insert(s.forecasts).values({
          questionId,
          userId: f.users.memberB.id,
          probability: "0.1000",
          rationale: "forged",
        }),
      ),
      /row-level security/,
    );
  });

  it("faculty is read-only: cannot insert a forecast question", async () => {
    await rejects(
      withUser(f.users.faculty.id, (tx) =>
        tx.insert(s.forecastQuestions).values({
          seasonId: f.season.id,
          prompt: "faculty should not be able to write this",
          resolutionCriteria: "n/a",
          closesAt: new Date(Date.now() + 86_400_000),
        }),
      ),
      /row-level security/,
    );
  });
});

describe("H4: positions become visible to other members after settlement", () => {
  it("A can read B's position once the season is settled", async () => {
    const { db, season } = f;
    for (const state of ["closed", "settled"] as const) {
      await db
        .update(s.seasons)
        .set({ state })
        .where(sql`${s.seasons.id} = ${season.id}`);
    }
    const asA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.positions)
        .where(sql`${s.positions.id} = ${positionB}`),
    );
    expect(asA).toHaveLength(1);
    const thesisAsA = await withUser(f.users.memberA.id, (tx) =>
      tx
        .select()
        .from(s.theses)
        .where(sql`${s.theses.positionId} = ${positionB}`),
    );
    expect(thesisAsA).toHaveLength(1);
  });
});

describe("SET LOCAL through the transaction pooler", () => {
  const poolerUrl = process.env.DATABASE_POOLER_URL;
  const run = poolerUrl ? it : it.skip;

  run(
    "scopes role and app.user_id to one transaction and leaks nothing after",
    async () => {
      const client = postgres(poolerUrl!, { prepare: false, max: 1 });
      try {
        const inside = await client.begin(async (tx) => {
          await tx.unsafe("SET LOCAL ROLE wows_app");
          await tx`SELECT set_config('app.user_id', ${f.users.memberA.id}, true)`;
          const [row] = await tx<{ role: string; uid: string }[]>`
          SELECT current_user AS role, current_setting('app.user_id', true) AS uid`;
          const positions =
            await tx`SELECT id FROM positions WHERE id = ${positionB}`;
          return { ...row!, positions: positions.length };
        });
        expect(inside.role).toBe("wows_app");
        expect(inside.uid).toBe(f.users.memberA.id);

        const [after] = await client<{ role: string; uid: string | null }[]>`
        SELECT current_user AS role, current_setting('app.user_id', true) AS uid`;
        expect(after!.role).toBe("postgres");
        expect(after!.uid ?? "").toBe("");
      } finally {
        await client.end({ timeout: 5 });
      }
    },
  );
});
