/**
 * Reading price bars off a committed snapshot into an engine `BarSource`.
 *
 * File access lives here rather than in `src/engine` so the engine stays a
 * pure library. Phase 4 will build the same shape from `price_bars` instead;
 * the engine cannot tell the difference, which is the point of the boundary.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBarSource, monthlyStepDates } from "@/engine/prices";
import type { BarSource, IsoDate, Symbol_ } from "@/engine/types";

const SNAPSHOT_ROOT = join(process.cwd(), "data", "snapshots");

interface Bar {
  date: IsoDate;
  closePaise: bigint;
}

/**
 * Bars and calendar for the given symbols only. The file is a hundred thousand
 * rows and a scenario needs a handful of symbols, so it is filtered while
 * parsing rather than after.
 */
export function loadSnapshotBars(
  symbols: readonly Symbol_[],
  version = 1,
): BarSource {
  const dir = join(SNAPSHOT_ROOT, `v${version}`);
  const wanted = new Set(symbols);
  const bars = new Map<Symbol_, Bar[]>();
  for (const symbol of symbols) bars.set(symbol, []);

  const text = readFileSync(join(dir, "bars.csv"), "utf8");
  let cursor = text.indexOf("\n") + 1; // past the header
  while (cursor < text.length) {
    const lineEnd = text.indexOf("\n", cursor);
    const end = lineEnd === -1 ? text.length : lineEnd;
    const line = text.slice(cursor, end);
    cursor = end + 1;
    if (line.length === 0) continue;

    const firstComma = line.indexOf(",");
    const symbol = line.slice(0, firstComma);
    if (!wanted.has(symbol)) continue;

    const fields = line.split(",");
    const date = fields[1];
    const close = fields[5];
    if (date === undefined || close === undefined) continue;
    bars.get(symbol)?.push({ date, closePaise: BigInt(close) });
  }

  for (const series of bars.values()) {
    series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  const calendar = readFileSync(join(dir, "calendar.csv"), "utf8")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return createBarSource(calendar, bars);
}

/** The dates a monthly scenario's steps land on, from the snapshot's calendar. */
export function snapshotStepDates(
  source: BarSource,
  start: IsoDate,
  end: IsoDate,
): IsoDate[] {
  return monthlyStepDates(source.calendar, start, end);
}
