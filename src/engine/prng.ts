/**
 * The engine's only source of randomness (H14).
 *
 * `Math.random` is banned: it cannot be seeded, so a run could never be
 * reproduced. This is mulberry32, a well-known 32-bit generator that is short
 * enough to read in full and whose entire state is one unsigned integer, which
 * is what makes a run serialisable mid-flight (H18).
 *
 * The scenario's seed is text (the schema stores it as text to avoid JS integer
 * limits), so it is hashed to 32 bits with FNV-1a. Both steps are deterministic
 * and depend on nothing but their inputs.
 */

export interface PrngState {
  /** Unsigned 32-bit. The whole of the generator's memory. */
  readonly value: number;
}

/** FNV-1a over the seed text. Deterministic across machines and runtimes. */
export function seedFromText(text: string): PrngState {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // The FNV prime, 16777619, by shift-and-add so it stays in 32 bits.
    hash = Math.imul(hash, 0x01000193);
  }
  return { value: hash >>> 0 };
}

/**
 * One draw. Returns the value and the next state; nothing is mutated, so a
 * caller that keeps the old state can replay from it exactly.
 */
export function nextFloat(state: PrngState): {
  value: number;
  state: PrngState;
} {
  let t = (state.value + 0x6d2b79f5) >>> 0;
  const next: PrngState = { value: t };
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/**
 * A whole number in `[min, max]`, both inclusive.
 * Used for the expense shock's size and timing, which are the only random
 * inputs in the engine.
 */
export function nextIntInclusive(
  state: PrngState,
  min: number,
  max: number,
): { value: number; state: PrngState } {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error("nextIntInclusive needs whole bounds");
  }
  if (max < min) throw new Error(`empty range ${min}..${max}`);
  const drawn = nextFloat(state);
  const span = max - min + 1;
  return {
    value: min + Math.floor(drawn.value * span),
    state: drawn.state,
  };
}

/** A bigint in `[min, max]`, both inclusive. For paise amounts. */
export function nextBigIntInclusive(
  state: PrngState,
  min: bigint,
  max: bigint,
): { value: bigint; state: PrngState } {
  if (max < min) throw new Error(`empty range ${min}..${max}`);
  const drawn = nextFloat(state);
  const span = max - min + 1n;
  // Scale through a fixed 1e9 grid so the result depends only on the draw,
  // never on floating-point division of a large bigint.
  const ticks = BigInt(Math.floor(drawn.value * 1_000_000_000));
  return { value: min + (span * ticks) / 1_000_000_000n, state: drawn.state };
}
