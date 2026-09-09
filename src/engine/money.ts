/**
 * Money and quantity arithmetic for the engine.
 *
 * Money is integer **paise** as `bigint` (H12). Quantity is a fixed-point
 * integer of **ten-thousandths of a unit**, also `bigint`, matching the
 * `numeric(18, 4)` columns in the schema. Neither ever becomes a JavaScript
 * `number`: `number` is exact only to 2^53, and a paise value that silently
 * loses its last digit is the kind of defect this project exists to avoid.
 *
 * Rounding rules live in docs/ENGINE_RULES.md. There are two, and the second
 * is a deliberate exception to the first:
 *
 *   1. A produced paise amount rounds **half away from zero**, once, where it
 *      is produced.
 *   2. A **buy quantity floors** to scale 4. Rounding a quantity up can
 *      overdraw cash by a paise, which the global rule would otherwise do
 *      silently.
 */

/** Integer paise. One rupee is 100n. */
export type Paise = bigint;

/** Ten-thousandths of one unit; the fixed-point form of `numeric(18, 4)`. */
export type Quantity = bigint;

export const QUANTITY_SCALE = 4;
export const QUANTITY_UNIT = 10_000n;
export const BPS = 10_000n;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Integer division rounding half away from zero. The global rule
 * (docs/ENGINE_RULES.md); used wherever a paise amount is produced.
 */
export function divRoundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator === 0n) throw new MoneyError("division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  // A tie is exactly half; "away from zero" means it rounds up in magnitude.
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** Integer division that always floors towards negative infinity. */
export function divFloor(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError("division by zero");
  const quotient = numerator / denominator;
  // BigInt division truncates towards zero, which is not floor for negatives.
  if (numerator % denominator !== 0n && numerator < 0n !== denominator < 0n) {
    return quotient - 1n;
  }
  return quotient;
}

/**
 * The paise value of `quantity` units at `price` per unit.
 * Produced amount, so it rounds half away from zero.
 */
export function valueOf(quantity: Quantity, price: Paise): Paise {
  return divRoundHalfAwayFromZero(quantity * price, QUANTITY_UNIT);
}

/** A fee in basis points on a gross amount. Produced amount; same rounding. */
export function feeOn(gross: Paise, bps: bigint): Paise {
  const magnitude = gross < 0n ? -gross : gross;
  return divRoundHalfAwayFromZero(magnitude * bps, BPS);
}

/**
 * The largest quantity of `price` units affordable with `cash`, once a fee of
 * `bps` on the gross is included, floored to scale 4 (the stated exception).
 *
 * Solved directly rather than by trial: q/10000 * price * (1 + bps/10000) <= cash.
 */
export function affordableQuantity(
  cash: Paise,
  price: Paise,
  bps: bigint,
): Quantity {
  if (price <= 0n) throw new MoneyError("price must be positive");
  if (cash <= 0n) return 0n;
  let quantity = divFloor(cash * QUANTITY_UNIT * BPS, price * (BPS + bps));
  // Rounding inside valueOf can push the last ten-thousandth over the top.
  // Stepping down is exact and terminates immediately in practice.
  while (quantity > 0n) {
    const gross = valueOf(quantity, price);
    if (gross + feeOn(gross, bps) <= cash) break;
    quantity -= 1n;
  }
  return quantity < 0n ? 0n : quantity;
}

/** Floors a quantity to scale 4. Quantities are already at that scale; this guards conversions. */
export function floorQuantity(quantity: Quantity): Quantity {
  return quantity;
}

/** `numeric(18, 4)` as Postgres returns it, e.g. "12.3400", into fixed point. */
export function quantityFromDecimalString(text: string): Quantity {
  const trimmed = text.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError(`not a decimal quantity: ${text}`);
  }
  const negative = trimmed.startsWith("-");
  const [whole = "0", fraction = ""] = trimmed.replace("-", "").split(".");
  if (fraction.length > QUANTITY_SCALE) {
    // Truncating here would hide precision the database is holding.
    const excess = fraction.slice(QUANTITY_SCALE);
    if (/[^0]/.test(excess)) {
      throw new MoneyError(
        `quantity ${text} has more than ${QUANTITY_SCALE} decimal places`,
      );
    }
  }
  const padded = fraction.padEnd(QUANTITY_SCALE, "0").slice(0, QUANTITY_SCALE);
  const magnitude = BigInt(whole) * QUANTITY_UNIT + BigInt(padded || "0");
  return negative ? -magnitude : magnitude;
}

/** Fixed point back to the string form `numeric(18, 4)` expects. */
export function quantityToDecimalString(quantity: Quantity): string {
  const negative = quantity < 0n;
  const magnitude = negative ? -quantity : quantity;
  const whole = magnitude / QUANTITY_UNIT;
  const fraction = (magnitude % QUANTITY_UNIT)
    .toString()
    .padStart(QUANTITY_SCALE, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
