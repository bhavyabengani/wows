/**
 * Rebuilding `holdings_cache` from the ledger.
 *
 * The cache is a cache in the strict sense (H13): every row in it is derivable
 * from `orders` and `fills`, which are append-only, and nothing is ever lost
 * by throwing it away. That is only true if it can actually be rebuilt, so it
 * is rebuilt by one command and a test proves the command works.
 *
 * The fold lives here rather than in the engine because it reads the database.
 * The arithmetic it performs is the same the engine performs on its own ledger,
 * and `src/engine/ledger.test.ts` covers that side.
 */
import { sql } from "drizzle-orm";
import {
  quantityFromDecimalString,
  quantityToDecimalString,
  type Quantity,
} from "@/engine/money";
import * as schema from "./schema";
import type { SystemDb } from "./system";

export interface RebuildSummary {
  readonly runs: number;
  readonly rows: number;
}

interface FillRow extends Record<string, unknown> {
  run_id: string;
  instrument_id: string;
  side: "buy" | "sell";
  quantity: string;
  step_index: number;
}

/**
 * Truncates the cache for the given run (or every run) and refolds it from the
 * fills. One transaction, so the cache is never half rebuilt.
 */
export async function rebuildHoldingsCache(
  db: SystemDb,
  runId?: string,
): Promise<RebuildSummary> {
  return db.transaction(async (tx) => {
    const fills = await tx.execute<FillRow>(sql`
      SELECT o.run_id, o.instrument_id, o.side, f.quantity, f.step_index
      FROM fills f
      JOIN orders o ON o.id = f.order_id
      ${runId === undefined ? sql`` : sql`WHERE o.run_id = ${runId}`}
      ORDER BY o.run_id, f.step_index, f.executed_at, f.id
    `);

    const byRun = new Map<
      string,
      { holdings: Map<string, Quantity>; asOfStep: number }
    >();
    for (const fill of fills) {
      const entry = byRun.get(fill.run_id) ?? {
        holdings: new Map<string, Quantity>(),
        asOfStep: 0,
      };
      const held = entry.holdings.get(fill.instrument_id) ?? 0n;
      const moved = quantityFromDecimalString(fill.quantity);
      entry.holdings.set(
        fill.instrument_id,
        fill.side === "buy" ? held + moved : held - moved,
      );
      if (fill.step_index > entry.asOfStep) entry.asOfStep = fill.step_index;
      byRun.set(fill.run_id, entry);
    }

    if (runId === undefined) {
      await tx.execute(sql`DELETE FROM holdings_cache`);
    } else {
      await tx.execute(sql`DELETE FROM holdings_cache WHERE run_id = ${runId}`);
    }

    let rows = 0;
    for (const [run, entry] of byRun) {
      const values = [...entry.holdings.entries()]
        // A position folded back to nothing is not a holding; keeping a zero
        // row would make the cache disagree with the ledger it came from.
        .filter(([, quantity]) => quantity !== 0n)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([instrumentId, quantity]) => ({
          runId: run,
          instrumentId,
          quantity: quantityToDecimalString(quantity),
          asOfStep: entry.asOfStep,
        }));
      if (values.length === 0) continue;
      await tx.insert(schema.holdingsCache).values(values);
      rows += values.length;
    }

    return { runs: byRun.size, rows };
  });
}
