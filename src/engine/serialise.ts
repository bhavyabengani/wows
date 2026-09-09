/**
 * Lossless JSON for a run (H18).
 *
 * `JSON.stringify` throws on `bigint`, and a codec that turned paise into
 * `number` would round the moment a value passed 2^53. So every bigint is
 * written as a tagged decimal string and read back as a bigint. The
 * generator's state travels with it, which is what lets a resumed run produce
 * the same subsequent output as one that was never interrupted.
 */
import type { RunState } from "./types";

/**
 * Deliberately unlikely to occur in real data. A shorter marker risks reading
 * a member's own text back as a number.
 */
const BIGINT_TAG = "__paise_bigint__:";

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? `${BIGINT_TAG}${value}` : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith(BIGINT_TAG)) {
    return BigInt(value.slice(BIGINT_TAG.length));
  }
  return value;
}

export function serialiseRun(run: RunState): string {
  return JSON.stringify(run, replacer);
}

export function deserialiseRun(text: string): RunState {
  return JSON.parse(text, reviver) as RunState;
}

/**
 * A stable string for comparing two runs byte for byte (H14, H17).
 *
 * Keys are emitted in sorted order at every level, so a difference in the
 * output is a difference in the run rather than a difference in the order two
 * objects happened to be built.
 */
export function canonicalJson(value: unknown): string {
  const walk = (input: unknown): unknown => {
    if (typeof input === "bigint") return `${BIGINT_TAG}${input}`;
    if (Array.isArray(input)) return input.map(walk);
    if (input !== null && typeof input === "object") {
      const entries = Object.entries(input as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return Object.fromEntries(entries.map(([k, v]) => [k, walk(v)]));
    }
    return input;
  };
  return JSON.stringify(walk(value), null, 2);
}
