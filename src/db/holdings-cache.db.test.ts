/**
 * The cache is only a cache (H13).
 *
 * The test that matters is the destructive one: corrupt the cache, rebuild it,
 * and check the right answer comes back. If that works, nothing depends on the
 * cache being correct, which is the whole claim.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rebuildHoldingsCache } from "./holdings-cache";
import * as schema from "./schema";
import { createSystemDb } from "./system";

const { db, close } = createSystemDb();

afterAll(async () => {
  await close();
});

interface Fixture {
  runId: string;
  reliance: string;
  tcs: string;
}

async function seedRunWithFills(): Promise<Fixture> {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1);
  const [game] = await db
    .select({ id: schema.gameInstances.id })
    .from(schema.gameInstances)
    .limit(1);
  if (!user || !game) throw new Error("run `npm run db:seed` first");

  const instruments = await db
    .select({ id: schema.instruments.id, symbol: schema.instruments.symbol })
    .from(schema.instruments)
    .where(sql`${schema.instruments.symbol} IN ('RELIANCE', 'TCS')`);
  const reliance = instruments.find((i) => i.symbol === "RELIANCE")?.id;
  const tcs = instruments.find((i) => i.symbol === "TCS")?.id;
  if (!reliance || !tcs)
    throw new Error("expected RELIANCE and TCS instruments");

  const [run] = await db
    .insert(schema.runs)
    .values({ gameInstanceId: game.id, userId: user.id, currentStep: 3 })
    .returning({ id: schema.runs.id });
  if (!run) throw new Error("could not create a run");

  // Buy 10, buy 5, sell 4 of RELIANCE; buy 2.5 of TCS. Folds to 11 and 2.5.
  const orders: {
    instrumentId: string;
    side: "buy" | "sell";
    quantity: string;
    step: number;
  }[] = [
    { instrumentId: reliance, side: "buy", quantity: "10.0000", step: 0 },
    { instrumentId: reliance, side: "buy", quantity: "5.0000", step: 1 },
    { instrumentId: reliance, side: "sell", quantity: "4.0000", step: 2 },
    { instrumentId: tcs, side: "buy", quantity: "2.5000", step: 3 },
  ];
  for (const [index, order] of orders.entries()) {
    const [row] = await db
      .insert(schema.orders)
      .values({
        runId: run.id,
        instrumentId: order.instrumentId,
        side: order.side,
        quantity: order.quantity,
        idempotencyKey: `${randomUUID()}-${index}`,
        stepIndex: order.step,
      })
      .returning({ id: schema.orders.id });
    if (!row) throw new Error("could not create an order");
    await db.insert(schema.fills).values({
      orderId: row.id,
      pricePaise: 100_000n,
      quantity: order.quantity,
      stepIndex: order.step,
    });
  }
  return { runId: run.id, reliance, tcs };
}

async function holdingsOf(runId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({
      instrumentId: schema.holdingsCache.instrumentId,
      quantity: schema.holdingsCache.quantity,
    })
    .from(schema.holdingsCache)
    .where(sql`${schema.holdingsCache.runId} = ${runId}`);
  return Object.fromEntries(rows.map((r) => [r.instrumentId, r.quantity]));
}

let fixture: Fixture;

beforeEach(async () => {
  fixture = await seedRunWithFills();
});

describe("rebuilding holdings from the ledger", () => {
  it("folds fills into the right quantities", async () => {
    const summary = await rebuildHoldingsCache(db, fixture.runId);
    expect(summary.rows).toBe(2);

    const holdings = await holdingsOf(fixture.runId);
    expect(holdings[fixture.reliance]).toBe("11.0000");
    expect(holdings[fixture.tcs]).toBe("2.5000");
  });

  it("restores the right answer after the cache is corrupted", async () => {
    await rebuildHoldingsCache(db, fixture.runId);

    // Someone, or something, writes a wrong number.
    await db.execute(sql`
      UPDATE holdings_cache SET quantity = '999.0000'
      WHERE run_id = ${fixture.runId} AND instrument_id = ${fixture.reliance}
    `);
    expect((await holdingsOf(fixture.runId))[fixture.reliance]).toBe(
      "999.0000",
    );

    await rebuildHoldingsCache(db, fixture.runId);
    expect((await holdingsOf(fixture.runId))[fixture.reliance]).toBe("11.0000");
  });

  it("restores rows that were deleted outright", async () => {
    await rebuildHoldingsCache(db, fixture.runId);
    await db.execute(
      sql`DELETE FROM holdings_cache WHERE run_id = ${fixture.runId}`,
    );
    expect(Object.keys(await holdingsOf(fixture.runId))).toHaveLength(0);

    await rebuildHoldingsCache(db, fixture.runId);
    const holdings = await holdingsOf(fixture.runId);
    expect(holdings[fixture.reliance]).toBe("11.0000");
    expect(holdings[fixture.tcs]).toBe("2.5000");
  });

  it("is idempotent: rebuilding twice changes nothing", async () => {
    await rebuildHoldingsCache(db, fixture.runId);
    const first = await holdingsOf(fixture.runId);
    await rebuildHoldingsCache(db, fixture.runId);
    expect(await holdingsOf(fixture.runId)).toEqual(first);
  });

  it("keeps no row for a position sold back to nothing", async () => {
    const [order] = await db
      .insert(schema.orders)
      .values({
        runId: fixture.runId,
        instrumentId: fixture.tcs,
        side: "sell",
        quantity: "2.5000",
        idempotencyKey: randomUUID(),
        stepIndex: 4,
      })
      .returning({ id: schema.orders.id });
    if (!order) throw new Error("could not create an order");
    await db.insert(schema.fills).values({
      orderId: order.id,
      pricePaise: 100_000n,
      quantity: "2.5000",
      stepIndex: 4,
    });

    await rebuildHoldingsCache(db, fixture.runId);
    const holdings = await holdingsOf(fixture.runId);
    expect(holdings[fixture.tcs]).toBeUndefined();
    expect(holdings[fixture.reliance]).toBe("11.0000");
  });
});
