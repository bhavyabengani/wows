/**
 * The engine's boundary, and its only real defence.
 *
 * The design constraint for this phase is that the engine is a pure library
 * with no knowledge of HTTP, React, Next.js or the database. That is easy to
 * state and easy to erode: one convenient import of a Drizzle type, and the
 * engine can no longer be reasoned about or tested on its own. So it is
 * checked mechanically rather than trusted.
 *
 * If Phase 4 finds it needs to change the engine in order to wire it to HTTP
 * and Postgres, the boundary was drawn in the wrong place, and the fix is to
 * move the boundary deliberately, not to add an exception here.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = join(__dirname);

/**
 * The only outside import the engine may make. Zod is a pure validator with
 * no I/O, no globals and no ambient state, and the scenario config schema is
 * required to be written with it.
 */
const ALLOWED_PACKAGES = new Set(["zod"]);

/** Tests and fixtures may reach further; the engine proper may not. */
const EXCLUDED = /\.test\.ts$|^test-support\.ts$/;

function engineSourceFiles(): string[] {
  return readdirSync(ENGINE_DIR)
    .filter((name) => name.endsWith(".ts") && !EXCLUDED.test(name))
    .sort();
}

/**
 * Comments legitimately name the very things these checks forbid: `prng.ts`
 * explains why `Math.random` is banned, and saying so must not itself fail the
 * check. Only code is scanned.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Every module specifier this file imports from, including type-only imports. */
function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) specifiers.push(specifier);
    }
  }
  return specifiers;
}

describe("the engine is a pure module", () => {
  const files = engineSourceFiles();

  it("has source files to check", () => {
    // Guards against the glob silently matching nothing and the suite passing
    // for the wrong reason.
    expect(files.length).toBeGreaterThan(5);
  });

  it("imports nothing but itself and the allowed packages", () => {
    const offenders: string[] = [];
    for (const name of files) {
      const source = stripComments(
        readFileSync(join(ENGINE_DIR, name), "utf8"),
      );
      for (const specifier of importsOf(source)) {
        const isRelative = specifier.startsWith("./");
        const isAllowed = ALLOWED_PACKAGES.has(specifier);
        if (!isRelative && !isAllowed) {
          offenders.push(`${name} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never reaches the app, the database, React or Next", () => {
    const forbidden = [
      /["']@\//,
      /["']next(\/|["'])/,
      /["']react(\/|["'])/,
      /["']drizzle-orm/,
      /["']postgres["']/,
      /["']@supabase/,
      /["']node:/,
      /\.\.\//,
    ];
    const offenders: string[] = [];
    for (const name of files) {
      const source = stripComments(
        readFileSync(join(ENGINE_DIR, name), "utf8"),
      );
      for (const pattern of forbidden) {
        for (const specifier of importsOf(source)) {
          if (pattern.test(`"${specifier}"`)) {
            offenders.push(`${name} imports ${specifier} (matched ${pattern})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("reads no ambient time or randomness", () => {
    // Both would make a run unreproducible, which H14 forbids. Time arrives as
    // an argument and randomness arrives as seeded state.
    const forbidden = [
      /\bMath\.random\b/,
      /\bDate\.now\b/,
      /\bnew Date\(\s*\)/,
      /\bprocess\.env\b/,
    ];
    const offenders: string[] = [];
    for (const name of files) {
      const source = stripComments(
        readFileSync(join(ENGINE_DIR, name), "utf8"),
      );
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${name} uses ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never uses floating point where money is concerned", () => {
    // parseFloat and toFixed are how paise quietly become approximations.
    const forbidden = [
      /\bparseFloat\b/,
      /\.toFixed\(/,
      /\bNumber\.parseFloat\b/,
    ];
    const offenders: string[] = [];
    for (const name of files) {
      const source = stripComments(
        readFileSync(join(ENGINE_DIR, name), "utf8"),
      );
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${name} uses ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
