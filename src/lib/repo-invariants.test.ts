/**
 * Repository-level guards for `[HARD]` invariants that are about the shape of
 * the codebase rather than runtime behaviour. See CLAUDE.md section 4.
 *
 *   H33 — one timezone conversion point (`src/lib/time.ts`)
 *   H36 — every direct dependency is justified in docs/DEPENDENCIES.md
 *   H37 — Python tooling is never merged into the Next.js app
 *   H11 — the app can never fetch a live price
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const packageJson = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const directDependencies = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
].sort();

describe("H36: every direct dependency is justified", () => {
  // Only the npm sections. The document also justifies the standalone Python
  // pipeline's dependencies, which are deliberately absent from package.json
  // (H37) and would otherwise read as stale entries.
  const doc = readFileSync(join(ROOT, "docs", "DEPENDENCIES.md"), "utf8").split(
    "## Market data pipeline (Python",
  )[0]!;
  // A justification is a table row whose first cell is the package name in
  // backticks: | `name` | ... |
  const justified = [...doc.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)]
    .map((m) => m[1])
    .filter((name): name is string => typeof name === "string")
    .sort();

  it("lists each package.json dependency in docs/DEPENDENCIES.md", () => {
    const missing = directDependencies.filter((d) => !justified.includes(d));
    expect(
      missing,
      "add a line for each of these to docs/DEPENDENCIES.md",
    ).toEqual([]);
  });

  it("has no stale justification for a package that is no longer installed", () => {
    const stale = justified.filter((d) => !directDependencies.includes(d));
    expect(stale, "remove these from docs/DEPENDENCIES.md").toEqual([]);
  });
});

describe("H33: src/lib/time.ts is the only timezone conversion point", () => {
  const CONVERSION_POINT = join(ROOT, "src", "lib", "time.ts");
  const FORBIDDEN = [
    /\btoLocale(Date|Time)?String\b/,
    /\bgetTimezoneOffset\b/,
    /Asia\/Kolkata/,
    /\btimeZone\s*:/,
    /\bIntl\.DateTimeFormat\b/,
  ];

  it("no other source file touches timezone APIs", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (file === CONVERSION_POINT) continue;
      if (/\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          offenders.push(`${relative(ROOT, file)} matches ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("H37: Python tooling stays out of the Next.js app", () => {
  it("has no Python files under src/", () => {
    const python = walk(join(ROOT, "src"))
      .filter((f) => /\.py$|requirements\.txt$|pyproject\.toml$/.test(f))
      .map((f) => relative(ROOT, f));
    expect(python).toEqual([]);
  });

  it("has no Python bridge packages in package.json", () => {
    const bridges = directDependencies.filter((d) => /python|pyodide/i.test(d));
    expect(bridges).toEqual([]);
  });

  it("has no import of the ingestion pipeline from application code", () => {
    // The only thing that may cross from data/ingest into the app is the
    // directory of snapshot files it writes, read at load time by
    // src/db/snapshot.ts.
    const offenders: string[] = [];
    for (const file of [
      ...walk(join(ROOT, "src")),
      ...walk(join(ROOT, "scripts")),
    ]) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      if (
        /from\s+["'][^"']*data\/ingest|require\(["'][^"']*data\/ingest/.test(
          source,
        )
      ) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("H11: market data is a pinned snapshot, never a live feed", () => {
  // If the app cannot reach a price source, it cannot accidentally show a live
  // price. Ingestion is the only thing that talks to one, and it is a separate
  // Python package that runs by hand.
  const FORBIDDEN = [
    /finance\.yahoo\.com/,
    /nseindia/i,
    /\byfinance\b/,
    /\bcurl_cffi\b/,
    /query[12]\.finance/,
  ];

  it("no source file under src/ or scripts/ names a price source", () => {
    const offenders: string[] = [];
    for (const file of [
      ...walk(join(ROOT, "src")),
      ...walk(join(ROOT, "scripts")),
    ]) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (/\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          offenders.push(`${relative(ROOT, file)} matches ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no market-data client among the npm dependencies", () => {
    const clients = directDependencies.filter((d) =>
      /yahoo|yfinance|alphavantage|iexcloud|polygon|marketstack/i.test(d),
    );
    expect(clients).toEqual([]);
  });
});

describe("H2: the RLS-bypassing system paths never reach request code", () => {
  it("src/app imports neither @/db/system nor @/lib/supabase/admin", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src", "app"))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      if (
        /@\/db\/system|@\/lib\/supabase\/admin|\/db\/system"|supabase\/admin"/.test(
          source,
        )
      ) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
