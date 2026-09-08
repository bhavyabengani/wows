/**
 * Database-enforced invariants: append-only tables (H7, H8, H31),
 * uniqueness (H6, H8, H10), forecast lock against server time (H10, H20),
 * season state machine, settled-season guard (H5), money as integer paise
 * (H12, schema shape). All checks run through the privileged connection on
 * purpose: these rules must hold even for the service role.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUser } from "./client";
import * as s from "./schema";
import { createFixture, rejects, type Fixture } from "./test-support";

let f: Fixture;
beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await f.close();
});

describe("append-only tables reject UPDATE and DELETE even for the system role", () => {
  it("price_bars (H7)", async () => {
    const { db, instrument } = f;
    await db.insert(s.priceBars).values({
      instrumentId: instrument.id,
      tradeDate: "2024-01-02",
      snapshotVersion: 1,
      openPaise: 100_00n,
      highPaise: 110_00n,
      lowPaise: 95_00n,
      closePaise: 105_00n,
      volume: 1000n,
    });
    await rejects(
      db
        .update(s.priceBars)
        .set({ closePaise: 1n })
        .where(sql`${s.priceBars.instrumentId} = ${instrument.id}`),
      /append-only/,
    );
    await rejects(
      db
        .delete(s.priceBars)
        .where(sql`${s.priceBars.instrumentId} = ${instrument.id}`),
      /append-only/,
    );
    await rejects(db.execute(sql`TRUNCATE price_bars`), /append-only/);
  });

  it("orders and fills (H8) — and orders are unique on (run_id, idempotency_key)", async () => {
    const { db, season, instrument, users } = f;
    const [scenario] = await db
      .insert(s.scenarios)
      .values({
        name: `scn-${f.tag}`,
        version: 1,
        configJson: {},
        seed: "1",
        universe: [instrument.symbol],
        startDate: "2024-01-01",
        endDate: "2024-02-01",
      })
      .returning();
    const [game] = await db
      .insert(s.gameInstances)
      .values({
        scenarioId: scenario!.id,
        seasonId: season.id,
        opensAt: new Date("2026-01-02T00:00:00Z"),
        closesAt: new Date("2026-01-30T00:00:00Z"),
        state: "open",
      })
      .returning();
    const [run] = await db
      .insert(s.runs)
      .values({ gameInstanceId: game!.id, userId: users.memberA.id })
      .returning();
    const [order] = await db
      .insert(s.orders)
      .values({
        runId: run!.id,
        instrumentId: instrument.id,
        side: "buy",
        quantity: "10.0000",
        idempotencyKey: `k-${f.tag}`,
        stepIndex: 0,
      })
      .returning();

    await rejects(
      db.insert(s.orders).values({
        runId: run!.id,
        instrumentId: instrument.id,
        side: "sell",
        quantity: "1.0000",
        idempotencyKey: `k-${f.tag}`,
        stepIndex: 1,
      }),
      /orders_run_idempotency_key/,
    );

    await rejects(
      db
        .update(s.orders)
        .set({ stepIndex: 9 })
        .where(sql`${s.orders.id} = ${order!.id}`),
      /append-only/,
    );
    await rejects(
      db.delete(s.orders).where(sql`${s.orders.id} = ${order!.id}`),
      /append-only/,
    );

    const [fill] = await db
      .insert(s.fills)
      .values({
        orderId: order!.id,
        pricePaise: 12345n,
        quantity: "10.0000",
        stepIndex: 0,
      })
      .returning();
    await rejects(
      db
        .update(s.fills)
        .set({ pricePaise: 1n })
        .where(sql`${s.fills.id} = ${fill!.id}`),
      /append-only/,
    );
    await rejects(
      db.delete(s.fills).where(sql`${s.fills.id} = ${fill!.id}`),
      /append-only/,
    );

    // Scenario configs are never edited in place (H6); (name, version) is unique.
    await rejects(
      db
        .update(s.scenarios)
        .set({ seed: "2" })
        .where(sql`${s.scenarios.id} = ${scenario!.id}`),
      /append-only/,
    );
    await rejects(
      db.insert(s.scenarios).values({
        name: `scn-${f.tag}`,
        version: 1,
        configJson: {},
        seed: "1",
        universe: [],
        startDate: "2024-01-01",
        endDate: "2024-02-01",
      }),
      /scenarios_name_version_key/,
    );
  });

  it("audit_log (H31)", async () => {
    const [row] = await f.db
      .insert(s.auditLog)
      .values({ action: "test", entityType: "test", entityId: f.tag })
      .returning();
    await rejects(
      f.db
        .update(s.auditLog)
        .set({ action: "edited" })
        .where(sql`${s.auditLog.id} = ${row!.id}`),
      /append-only/,
    );
    await rejects(
      f.db.delete(s.auditLog).where(sql`${s.auditLog.id} = ${row!.id}`),
      /append-only/,
    );
  });

  it("theses (H9): revisions are new rows, never updates", async () => {
    const { db, season, instrument, users } = f;
    const [pos] = await db
      .insert(s.positions)
      .values({
        seasonId: season.id,
        userId: users.memberA.id,
        instrumentId: instrument.id,
      })
      .returning();
    const [t1] = await db
      .insert(s.theses)
      .values({ positionId: pos!.id, body: "v1", keyRisk: "r", falsifier: "f" })
      .returning();
    await rejects(
      db
        .update(s.theses)
        .set({ body: "edited" })
        .where(sql`${s.theses.id} = ${t1!.id}`),
      /append-only/,
    );
    const [t2] = await db
      .insert(s.theses)
      .values({
        positionId: pos!.id,
        revision: 2,
        body: "v2",
        keyRisk: "r",
        falsifier: "f",
      })
      .returning();
    expect(t2!.revision).toBe(2);
    await rejects(
      db.insert(s.theses).values({
        positionId: pos!.id,
        revision: 2,
        body: "dup",
        keyRisk: "r",
        falsifier: "f",
      }),
      /theses_position_revision_key/,
    );
  });
});

describe("forecasts (H10, H20): one per (question, user); locked at closes_at by server time", () => {
  it("rejects a duplicate, counts revisions, then locks", async () => {
    const { db, season, users } = f;
    const [q] = await db
      .insert(s.forecastQuestions)
      .values({
        seasonId: season.id,
        prompt: `q-${f.tag}`,
        resolutionCriteria: "n/a",
        closesAt: new Date(Date.now() + 60_000),
      })
      .returning();

    const [fc] = await withUser(users.memberA.id, (tx) =>
      tx
        .insert(s.forecasts)
        .values({
          questionId: q!.id,
          userId: users.memberA.id,
          probability: "0.5000",
          rationale: "first",
        })
        .returning(),
    );
    expect(fc!.revisedCount).toBe(0);

    await rejects(
      withUser(users.memberA.id, (tx) =>
        tx.insert(s.forecasts).values({
          questionId: q!.id,
          userId: users.memberA.id,
          probability: "0.6000",
          rationale: "dup",
        }),
      ),
      /forecasts_question_user_key/,
    );

    const [revised] = await withUser(users.memberA.id, (tx) =>
      tx
        .update(s.forecasts)
        .set({ probability: "0.6500", rationale: "revised" })
        .where(sql`${s.forecasts.id} = ${fc!.id}`)
        .returning(),
    );
    expect(revised!.revisedCount).toBe(1);
    expect(revised!.probability).toBe("0.6500");

    // Move the deadline into the past (server clock), then every write fails.
    await db
      .update(s.forecastQuestions)
      .set({ closesAt: sql`now() - interval '1 second'` })
      .where(sql`${s.forecastQuestions.id} = ${q!.id}`);
    await rejects(
      withUser(users.memberA.id, (tx) =>
        tx
          .update(s.forecasts)
          .set({ probability: "0.9000" })
          .where(sql`${s.forecasts.id} = ${fc!.id}`),
      ),
      /closed at/,
    );
    await rejects(
      withUser(users.memberB.id, (tx) =>
        tx.insert(s.forecasts).values({
          questionId: q!.id,
          userId: users.memberB.id,
          probability: "0.2000",
          rationale: "late",
        }),
      ),
      /closed at/,
    );
    // Even the system role cannot edit after the deadline.
    await rejects(
      db
        .update(s.forecasts)
        .set({ probability: "0.9000" })
        .where(sql`${s.forecasts.id} = ${fc!.id}`),
      /closed at/,
    );
    await rejects(
      db.delete(s.forecasts).where(sql`${s.forecasts.id} = ${fc!.id}`),
      /closed at/,
    );
  });
});

describe("season state machine", () => {
  it("rejects draft → settled and every other skip", async () => {
    const { db } = f;
    const [season] = await db
      .insert(s.seasons)
      .values({
        name: `sm-${f.tag}`,
        startsAt: new Date("2027-01-01T00:00:00Z"),
        endsAt: new Date("2027-06-01T00:00:00Z"),
      })
      .returning();
    const set = (state: (typeof s.seasonStateEnum.enumValues)[number]) =>
      db
        .update(s.seasons)
        .set({ state })
        .where(sql`${s.seasons.id} = ${season!.id}`);

    await rejects(set("settled"), /invalid season transition/);
    await rejects(set("closed"), /invalid season transition/);
    await rejects(set("archived"), /invalid season transition/);
    await set("open");
    await rejects(set("draft"), /invalid season transition/);
    await rejects(set("settled"), /invalid season transition/);
    await set("closed");
    await rejects(set("open"), /invalid season transition/);
    await set("settled");
    await rejects(set("open"), /invalid season transition/);
    await rejects(
      db
        .update(s.seasons)
        .set({ name: "renamed" })
        .where(sql`${s.seasons.id} = ${season!.id}`),
      /cannot be modified/,
    );
    await set("archived");
    await rejects(
      db.delete(s.seasons).where(sql`${s.seasons.id} = ${season!.id}`),
      /only draft seasons/,
    );
  });
});

describe("settled-season guard (H5)", () => {
  it("freezes season-scoped rows, including indirect ones, once settled", async () => {
    const { db, instrument, users } = f;
    const [season] = await db
      .insert(s.seasons)
      .values({
        name: `settled-${f.tag}`,
        startsAt: new Date("2025-01-01T00:00:00Z"),
        endsAt: new Date("2025-06-01T00:00:00Z"),
      })
      .returning();
    const sid = season!.id;
    await db
      .update(s.seasons)
      .set({ state: "open" })
      .where(sql`${s.seasons.id} = ${sid}`);
    const [q] = await db
      .insert(s.forecastQuestions)
      .values({
        seasonId: sid,
        prompt: "settled q",
        resolutionCriteria: "n/a",
        closesAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const [fc] = await db
      .insert(s.forecasts)
      .values({
        questionId: q!.id,
        userId: users.memberA.id,
        probability: "0.5000",
        rationale: "before",
      })
      .returning();
    const [pos] = await db
      .insert(s.positions)
      .values({
        seasonId: sid,
        userId: users.memberA.id,
        instrumentId: instrument.id,
      })
      .returning();
    const [ev] = await db
      .insert(s.events)
      .values({
        seasonId: sid,
        title: "settled event",
        startsAt: new Date("2025-03-01T00:00:00Z"),
        capacity: 5,
        location: "x",
      })
      .returning();

    for (const state of ["closed", "settled"] as const) {
      await db
        .update(s.seasons)
        .set({ state })
        .where(sql`${s.seasons.id} = ${sid}`);
    }

    await rejects(
      db
        .update(s.forecasts)
        .set({ rationale: "after" })
        .where(sql`${s.forecasts.id} = ${fc!.id}`),
      /is settled/,
    );
    await rejects(
      db
        .update(s.positions)
        .set({ closedAt: new Date() })
        .where(sql`${s.positions.id} = ${pos!.id}`),
      /is settled/,
    );
    await rejects(
      db.insert(s.theses).values({
        positionId: pos!.id,
        body: "late",
        keyRisk: "r",
        falsifier: "f",
      }),
      /is settled/,
    );
    await rejects(
      db.insert(s.rsvps).values({ eventId: ev!.id, userId: users.memberA.id }),
      /is settled/,
    );
    await rejects(
      db.insert(s.scores).values({
        userId: users.memberA.id,
        seasonId: sid,
        track: "t",
        value: "1.0000",
        componentsJson: {},
      }),
      /is settled/,
    );
    await rejects(
      db.delete(s.events).where(sql`${s.events.id} = ${ev!.id}`),
      /is settled/,
    );
  });
});

describe("money is integer paise (H12)", () => {
  it("every *_paise column is bigint and no currency column is floating point", async () => {
    const rows = await f.db.execute<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (column_name LIKE '%paise%' OR column_name ~ '(price|amount|cash|value_inr)')
    `);
    expect([...rows].length).toBeGreaterThan(0);
    for (const r of rows) {
      if (r.column_name.endsWith("_paise"))
        expect(r.data_type, `${r.table_name}.${r.column_name}`).toBe("bigint");
      expect(["real", "double precision"]).not.toContain(r.data_type);
    }
  });

  it("rejects a non-positive price", async () => {
    await rejects(
      f.db.insert(s.priceBars).values({
        instrumentId: f.instrument.id,
        tradeDate: "2024-01-03",
        snapshotVersion: 1,
        openPaise: 0n,
        highPaise: 1n,
        lowPaise: 1n,
        closePaise: 1n,
        volume: 0n,
      }),
      /price_bars_positive_prices/,
    );
  });
});
