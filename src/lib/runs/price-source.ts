/**
 * A `BarSource` backed by `price_bars`.
 *
 * The engine cannot tell this apart from the one that reads a CSV, which is
 * what the Phase 3 boundary was for.
 *
 * **It refuses to load a bar past the step the run has reached.** The engine's
 * accessor already makes a future price impossible to *ask* for (H15); this
 * makes it impossible to have *fetched*. Two independent defences, because the
 * consequence of getting this wrong is a member seeing next month's prices.
 */
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { createBarSource } from "@/engine/prices";
import type { BarSource, IsoDate, Symbol_ } from "@/engine/types";
import { instruments, priceBars } from "@/db/schema";
import type { Tx } from "@/db/client";

export interface BarWindow {
  readonly symbols: readonly Symbol_[];
  readonly snapshotVersion: number;
  /** No bar after this date is read. Always the run's current step date. */
  readonly upToDate: IsoDate;
}

export async function loadBarSource(
  tx: Tx,
  window: BarWindow,
): Promise<BarSource> {
  const rows = await tx
    .select({
      symbol: instruments.symbol,
      date: priceBars.tradeDate,
      closePaise: priceBars.closePaise,
    })
    .from(priceBars)
    .innerJoin(instruments, eq(instruments.id, priceBars.instrumentId))
    .where(
      and(
        eq(priceBars.snapshotVersion, window.snapshotVersion),
        inArray(instruments.symbol, [...window.symbols]),
        lte(priceBars.tradeDate, window.upToDate),
      ),
    )
    .orderBy(asc(instruments.symbol), asc(priceBars.tradeDate));

  const bars = new Map<Symbol_, { date: IsoDate; closePaise: bigint }[]>();
  for (const symbol of window.symbols) bars.set(symbol, []);
  for (const row of rows) {
    bars.get(row.symbol)?.push({ date: row.date, closePaise: row.closePaise });
  }

  // The calendar is every date any instrument traded on, within the window
  // already read. The engine only ever indexes it by step, so it needs no
  // more than the dates it can legitimately see.
  const dates = new Set<IsoDate>();
  for (const series of bars.values()) {
    for (const bar of series) dates.add(bar.date);
  }
  return createBarSource([...dates].sort(), bars);
}
