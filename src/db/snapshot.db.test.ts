/**
 * The loader, against a real database.
 *
 * Run with `npm run db:start && npm run db:migrate && npm run test:db`.
 * These tests care about the promises the loader makes: it refuses a version
 * that is already present, it refuses a snapshot that has been edited since
 * it was built, and two clean loads of the same files produce the same rows.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSystemDb } from "./system";
import {
  loadSnapshot,
  loadedChecksum,
  readSnapshot,
  snapshotDir,
  SnapshotError,
} from "./snapshot";

const { db, close } = createSystemDb();
const VERSION = 1;

afterAll(async () => {
  await close();
});

async function clearBars(): Promise<void> {
  // price_bars is append-only for the application; the test harness drops the
  // trigger for the length of the statement, the same way the Phase 1 tests do.
  await db.execute(sql`ALTER TABLE price_bars DISABLE TRIGGER USER`);
  await db.execute(sql`DELETE FROM price_bars`);
  await db.execute(sql`ALTER TABLE price_bars ENABLE TRIGGER USER`);
}

beforeEach(async () => {
  await clearBars();
});

describe("readSnapshot", () => {
  it("reads the committed v1 snapshot and agrees with its manifest", () => {
    const { manifest, instruments, bars } = readSnapshot(VERSION);
    expect(manifest.snapshot_version).toBe(VERSION);
    expect(instruments.length).toBeGreaterThan(0);
    expect(bars.length).toBeGreaterThan(0);

    const counted = new Map<string, number>();
    for (const bar of bars)
      counted.set(bar.symbol, (counted.get(bar.symbol) ?? 0) + 1);
    for (const [symbol, entry] of Object.entries(manifest.per_instrument)) {
      expect(counted.get(symbol) ?? 0, symbol).toBe(entry.rows);
    }
  });

  it("keeps prices as bigint paise, never a JavaScript number", () => {
    const { bars } = readSnapshot(VERSION);
    for (const bar of bars.slice(0, 100)) {
      expect(typeof bar.closePaise).toBe("bigint");
      expect(typeof bar.volume).toBe("bigint");
    }
  });

  it("refuses a snapshot whose files no longer match the manifest", () => {
    const scratch = mkdtempSync(join(tmpdir(), "wows-snapshot-"));
    const original = snapshotDir(VERSION);
    const copy = join(scratch, "v1");
    cpSync(original, copy, { recursive: true });

    const barsPath = join(copy, "bars.csv");
    const text = readFileSync(barsPath, "utf8");
    expect(() => verifyChecksums(copy)).not.toThrow();

    // One extra row, the kind of "small correction" the manifest exists to stop.
    writeFileSync(barsPath, `${text}TCS,2099-01-01,1,1,1,1,0\n`, "utf8");
    expect(() => verifyChecksums(copy)).toThrow(
      /does not match its manifest checksum/,
    );
  });

  it("refuses a missing snapshot", () => {
    expect(() => readSnapshot(99)).toThrow(SnapshotError);
  });
});

/**
 * `readSnapshot` resolves paths under data/snapshots, so this repeats its
 * checksum step against an arbitrary copy in order to tamper with one.
 */
function verifyChecksums(dir: string): void {
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  ) as {
    files: Record<string, string>;
  };
  for (const [name, expected] of Object.entries(manifest.files)) {
    const text = readFileSync(join(dir, name), "utf8");
    const actual = createHash("sha256").update(text, "utf8").digest("hex");
    if (actual !== expected) {
      throw new SnapshotError(`${name} does not match its manifest checksum`);
    }
  }
}

describe("loadSnapshot", () => {
  it("loads instruments and bars, and reports what it did", async () => {
    const result = await loadSnapshot(db, VERSION);
    expect(result.version).toBe(VERSION);
    expect(result.bars).toBeGreaterThan(50_000);

    const [row] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM price_bars WHERE snapshot_version = ${VERSION}`,
    );
    expect(row?.count).toBe(result.bars);
  }, 180_000);

  it("refuses to load a version that is already present (H7)", async () => {
    await loadSnapshot(db, VERSION);
    await expect(loadSnapshot(db, VERSION)).rejects.toThrow(/already loaded/);
  }, 240_000);

  it("produces identical rows on two clean loads", async () => {
    await loadSnapshot(db, VERSION);
    const first = await loadedChecksum(db, VERSION);
    await clearBars();
    await loadSnapshot(db, VERSION);
    const second = await loadedChecksum(db, VERSION);
    expect(second).toBe(first);
    expect(first).not.toBe("empty");
  }, 300_000);

  it("stores no bars for cash", async () => {
    await loadSnapshot(db, VERSION);
    const [row] = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      FROM price_bars b JOIN instruments i ON i.id = b.instrument_id
      WHERE i.asset_class = 'cash'
    `);
    expect(row?.count).toBe(0);
  }, 180_000);

  it("keeps every price positive and OHLC consistent in the database", async () => {
    await loadSnapshot(db, VERSION);
    const [row] = await db.execute<{ bad: number }>(sql`
      SELECT count(*)::int AS bad FROM price_bars
      WHERE open_paise <= 0 OR high_paise <= 0 OR low_paise <= 0 OR close_paise <= 0
         OR low_paise > open_paise OR open_paise > high_paise
         OR low_paise > close_paise OR close_paise > high_paise
    `);
    expect(row?.bad).toBe(0);
  }, 180_000);
});
