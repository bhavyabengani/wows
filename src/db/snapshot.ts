/**
 * Reading a committed snapshot, and loading it into the database.
 *
 * The loader lives in TypeScript rather than in the Python pipeline so that
 * there is exactly one path that writes to this database, reusing the schema
 * and the append-only guarantees from Phase 1. The pipeline's job ends when it
 * has written files; this file's job is to refuse anything it should not
 * insert, and it refuses before it inserts, never halfway through.
 *
 * `price_bars` are append-only and immutable (H7). A correction is a new
 * `snapshot_version` loaded alongside the old one, so this loader will not
 * overwrite, upsert or delete a bar, and it stops if the version it was asked
 * for is already present.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { SystemDb } from "./system";

export const SNAPSHOT_ROOT = join(process.cwd(), "data", "snapshots");

/** Files whose checksums the manifest records. */
const CHECKED_FILES = [
  "instruments.csv",
  "bars.csv",
  "calendar.csv",
  "corporate-actions.csv",
  "excluded-rows.csv",
  "policy.json",
] as const;

export interface Manifest {
  snapshot_version: number;
  built_at: string;
  fetch_date: string;
  /** Prices carry corporate-action adjustments up to `adjusted_as_of`. */
  is_adjusted: boolean;
  adjusted_as_of: string;
  /** "price_return": dividends are not in the series, for any instrument. */
  price_basis: string;
  dividends_included: boolean;
  fd_series_verified: boolean;
  per_instrument: Record<
    string,
    { rows: number; first_date: string | null; last_date: string | null }
  >;
  files: Record<string, string>;
  scenario_windows: { name: string; start: string; end: string }[];
}

export interface InstrumentRow {
  symbol: string;
  name: string;
  assetClass: (typeof schema.assetClassEnum.enumValues)[number];
  isActive: boolean;
}

export interface BarRow {
  symbol: string;
  tradeDate: string;
  openPaise: bigint;
  highPaise: bigint;
  lowPaise: bigint;
  closePaise: bigint;
  volume: bigint;
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

/**
 * A snapshot must say how to read its prices. A build from before this
 * metadata existed would otherwise load with the fields quietly undefined, and
 * a screen would print an adjusted level as though it were what traded.
 */
export function assertManifestDescribesPrices(manifest: Manifest): void {
  for (const field of [
    "fetch_date",
    "adjusted_as_of",
    "price_basis",
  ] as const) {
    if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
      throw new SnapshotError(
        `manifest is missing ${field}; rebuild the snapshot with the current pipeline`,
      );
    }
  }
  for (const field of ["is_adjusted", "dividends_included"] as const) {
    if (typeof manifest[field] !== "boolean") {
      throw new SnapshotError(
        `manifest is missing ${field}; rebuild the snapshot with the current pipeline`,
      );
    }
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Minimal CSV reader. The pipeline writes these files itself, with no quoting
 * beyond what the standard writer emits, so this handles quoted fields and
 * embedded commas and nothing more exotic.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  if (!header) throw new SnapshotError("empty CSV");
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function snapshotDir(version: number): string {
  return join(SNAPSHOT_ROOT, `v${version}`);
}

/**
 * Reads a snapshot from disk and verifies every recorded checksum before
 * returning anything. A snapshot that has been edited by hand since it was
 * built cannot be loaded, which is what the manifest is for.
 */
export function readSnapshot(version: number): {
  manifest: Manifest;
  instruments: InstrumentRow[];
  bars: BarRow[];
} {
  const dir = snapshotDir(version);
  let manifestText: string;
  try {
    manifestText = readFileSync(join(dir, "manifest.json"), "utf8");
  } catch {
    throw new SnapshotError(`no snapshot at ${dir}: build it before loading`);
  }
  const manifest = JSON.parse(manifestText) as Manifest;
  assertManifestDescribesPrices(manifest);
  if (manifest.snapshot_version !== version) {
    throw new SnapshotError(
      `manifest says version ${manifest.snapshot_version} but it is filed under v${version}`,
    );
  }

  const contents = new Map<string, string>();
  for (const name of CHECKED_FILES) {
    const text = readFileSync(join(dir, name), "utf8");
    const expected = manifest.files[name];
    if (!expected) {
      throw new SnapshotError(`manifest records no checksum for ${name}`);
    }
    const actual = sha256(text);
    if (actual !== expected) {
      throw new SnapshotError(
        `${name} does not match its manifest checksum (expected ${expected}, got ${actual}). ` +
          `A snapshot is immutable: correct it by building a new version, never by editing this one.`,
      );
    }
    contents.set(name, text);
  }

  const instruments = parseCsv(contents.get("instruments.csv") ?? "").map(
    (r) => ({
      symbol: r.symbol ?? "",
      name: r.name ?? "",
      assetClass: r.asset_class as InstrumentRow["assetClass"],
      isActive: r.is_active === "true",
    }),
  );
  const bars = parseCsv(contents.get("bars.csv") ?? "").map((r) => ({
    symbol: r.symbol ?? "",
    tradeDate: r.trade_date ?? "",
    openPaise: BigInt(r.open_paise ?? "0"),
    highPaise: BigInt(r.high_paise ?? "0"),
    lowPaise: BigInt(r.low_paise ?? "0"),
    closePaise: BigInt(r.close_paise ?? "0"),
    volume: BigInt(r.volume ?? "0"),
  }));

  const counted = new Map<string, number>();
  for (const bar of bars)
    counted.set(bar.symbol, (counted.get(bar.symbol) ?? 0) + 1);
  for (const [symbol, entry] of Object.entries(manifest.per_instrument)) {
    const actual = counted.get(symbol) ?? 0;
    if (actual !== entry.rows) {
      throw new SnapshotError(
        `${symbol}: manifest claims ${entry.rows} bars, file has ${actual}`,
      );
    }
  }
  const unknown = [...counted.keys()].filter(
    (s) => !(s in manifest.per_instrument),
  );
  if (unknown.length > 0) {
    throw new SnapshotError(
      `bars for instruments the manifest does not list: ${unknown.join(", ")}`,
    );
  }
  return { manifest, instruments, bars };
}

/** Rows are inserted in batches; postgres has a hard limit on parameters per statement. */
const BATCH = 2_000;

export interface LoadResult {
  version: number;
  instruments: number;
  bars: number;
  fdSeriesVerified: boolean;
  isAdjusted: boolean;
  adjustedAsOf: string;
  priceBasis: string;
}

/**
 * Loads a snapshot in a single transaction. Either the whole version lands or
 * none of it does, so a database can never hold half a snapshot.
 */
export async function loadSnapshot(
  db: SystemDb,
  version: number,
): Promise<LoadResult> {
  const { manifest, instruments, bars } = readSnapshot(version);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.priceBars)
      .where(sql`${schema.priceBars.snapshotVersion} = ${version}`);
    if ((existing?.count ?? 0) > 0) {
      throw new SnapshotError(
        `snapshot version ${version} is already loaded (${existing?.count} bars). ` +
          `price_bars are immutable: load a corrected snapshot as a new version instead.`,
      );
    }

    // Instruments are keyed by symbol and are not append-only, so re-loading a
    // snapshot into a database that already knows a symbol updates its name or
    // class rather than failing. Bars below are the append-only part.
    for (let i = 0; i < instruments.length; i += BATCH) {
      await tx
        .insert(schema.instruments)
        .values(instruments.slice(i, i + BATCH))
        .onConflictDoUpdate({
          target: schema.instruments.symbol,
          set: {
            name: sql`excluded.name`,
            assetClass: sql`excluded.asset_class`,
            isActive: sql`excluded.is_active`,
          },
        });
    }

    const idBySymbol = new Map<string, string>();
    for (const row of await tx
      .select({ id: schema.instruments.id, symbol: schema.instruments.symbol })
      .from(schema.instruments)) {
      idBySymbol.set(row.symbol, row.id);
    }

    const values = bars.map((bar) => {
      const instrumentId = idBySymbol.get(bar.symbol);
      if (!instrumentId) {
        throw new SnapshotError(
          `bar references unknown instrument ${bar.symbol}`,
        );
      }
      return {
        instrumentId,
        tradeDate: bar.tradeDate,
        snapshotVersion: version,
        openPaise: bar.openPaise,
        highPaise: bar.highPaise,
        lowPaise: bar.lowPaise,
        closePaise: bar.closePaise,
        volume: bar.volume,
      };
    });
    for (let i = 0; i < values.length; i += BATCH) {
      await tx.insert(schema.priceBars).values(values.slice(i, i + BATCH));
    }

    // How to read these prices travels with them. Without it a screen has no
    // way to know that a stored level is adjusted rather than what traded.
    const barsSha256 = manifest.files["bars.csv"];
    if (!barsSha256) {
      throw new SnapshotError("manifest records no checksum for bars.csv");
    }
    await tx.insert(schema.snapshots).values({
      version,
      builtAt: new Date(manifest.built_at),
      fetchDate: manifest.fetch_date,
      isAdjusted: manifest.is_adjusted,
      adjustedAsOf: manifest.adjusted_as_of,
      priceBasis: manifest.price_basis,
      dividendsIncluded: manifest.dividends_included,
      fdSeriesVerified: manifest.fd_series_verified,
      barsSha256,
    });

    return {
      version,
      instruments: instruments.length,
      bars: values.length,
      fdSeriesVerified: manifest.fd_series_verified,
      isAdjusted: manifest.is_adjusted,
      adjustedAsOf: manifest.adjusted_as_of,
      priceBasis: manifest.price_basis,
    };
  });
}

/**
 * A checksum of the loaded rows for one version, order-independent.
 * Two clean loads of the same snapshot must produce the same value.
 */
export async function loadedChecksum(
  db: SystemDb,
  version: number,
): Promise<string> {
  const [row] = await db.execute<{ digest: string }>(sql`
    SELECT COALESCE(
      md5(string_agg(line, E'\n' ORDER BY line)),
      'empty'
    ) AS digest
    FROM (
      SELECT i.symbol || '|' || b.trade_date || '|' || b.open_paise || '|' ||
             b.high_paise || '|' || b.low_paise || '|' || b.close_paise || '|' ||
             b.volume AS line
      FROM price_bars b
      JOIN instruments i ON i.id = b.instrument_id
      WHERE b.snapshot_version = ${version}
    ) rows
  `);
  return row?.digest ?? "empty";
}
