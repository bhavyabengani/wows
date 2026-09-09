/**
 * Money and quantity arithmetic, at the boundaries where it goes wrong.
 *
 * The rules under test are in docs/ENGINE_RULES.md: paise amounts round half
 * away from zero, and buy quantities floor as a stated exception to that rule.
 */
import { describe, expect, it } from "vitest";
import {
  affordableQuantity,
  divFloor,
  divRoundHalfAwayFromZero,
  feeOn,
  MoneyError,
  quantityFromDecimalString,
  quantityToDecimalString,
  valueOf,
} from "./money";

describe("rounding half away from zero", () => {
  it("rounds a tie away from zero in both directions", () => {
    // The distinguishing case: banker's rounding would send 5/2 to 2.
    expect(divRoundHalfAwayFromZero(5n, 2n)).toBe(3n);
    expect(divRoundHalfAwayFromZero(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfAwayFromZero(7n, 2n)).toBe(4n);
    expect(divRoundHalfAwayFromZero(-7n, 2n)).toBe(-4n);
  });

  it("leaves exact division alone", () => {
    expect(divRoundHalfAwayFromZero(10n, 5n)).toBe(2n);
    expect(divRoundHalfAwayFromZero(-10n, 5n)).toBe(-2n);
    expect(divRoundHalfAwayFromZero(0n, 5n)).toBe(0n);
  });

  it("rounds below a tie towards zero", () => {
    expect(divRoundHalfAwayFromZero(4n, 3n)).toBe(1n);
    expect(divRoundHalfAwayFromZero(-4n, 3n)).toBe(-1n);
  });

  it("refuses division by zero rather than returning something", () => {
    expect(() => divRoundHalfAwayFromZero(1n, 0n)).toThrow(MoneyError);
  });
});

describe("flooring", () => {
  it("floors towards negative infinity, not towards zero", () => {
    // BigInt division truncates, which is a different answer for negatives.
    expect(divFloor(7n, 2n)).toBe(3n);
    expect(divFloor(-7n, 2n)).toBe(-4n);
    expect(-7n / 2n).toBe(-3n);
  });
});

describe("valuing a holding", () => {
  it("multiplies quantity by price at scale 4", () => {
    // 2.5 units at 100.00 rupees is 250.00 rupees.
    expect(valueOf(25_000n, 10_000n)).toBe(25_000n);
  });

  it("rounds the produced paise amount, once", () => {
    // 1.0001 units at 1.00 rupee is 100.01 paise, which rounds down to 100.
    expect(valueOf(10_001n, 100n)).toBe(100n);
    // 1.0005 units is 100.05 paise: still below the halfway point.
    expect(valueOf(10_005n, 100n)).toBe(100n);
    // 1.0050 units is exactly 100.5 paise, a true tie, so it goes away from zero.
    expect(valueOf(10_050n, 100n)).toBe(101n);
    expect(valueOf(-10_050n, 100n)).toBe(-101n);
  });

  it("handles a holding large enough to overflow a JavaScript number", () => {
    // Ten crore rupees is 10^11 paise; a double is exact only to about 9x10^15,
    // and the intermediate product here is far past that.
    const quantity = 10_000_000n * 10_000n;
    const price = 1_000_000n;
    expect(valueOf(quantity, price)).toBe(10_000_000_000_000n);
  });
});

describe("transaction cost", () => {
  it("charges basis points on the gross", () => {
    // 10 bps on 1,00,000 rupees is 100 rupees.
    expect(feeOn(10_000_000n, 10n)).toBe(10_000n);
  });

  it("is charged on magnitude, so a sale is not a rebate", () => {
    expect(feeOn(-10_000_000n, 10n)).toBe(10_000n);
  });

  it("is zero when the scenario sets no cost", () => {
    expect(feeOn(10_000_000n, 0n)).toBe(0n);
  });
});

describe("affordable quantity", () => {
  const price = 10_000n; // 100.00 rupees per unit
  const bps = 10n;

  it("never spends more cash than there is", () => {
    for (const cash of [1n, 99n, 100n, 10_000n, 123_456n, 999_999n]) {
      const quantity = affordableQuantity(cash, price, bps);
      const gross = valueOf(quantity, price);
      expect(gross + feeOn(gross, bps)).toBeLessThanOrEqual(cash);
    }
  });

  it("leaves the cost room, so a full-cash buy does not overdraw", () => {
    // With 100.00 rupees and a 10 bps cost, one whole unit is unaffordable.
    const quantity = affordableQuantity(10_000n, price, bps);
    expect(quantity).toBeLessThan(10_000n);
    const gross = valueOf(quantity, price);
    expect(gross + feeOn(gross, bps)).toBeLessThanOrEqual(10_000n);
  });

  it("is zero when there is nothing to spend", () => {
    expect(affordableQuantity(0n, price, bps)).toBe(0n);
    expect(affordableQuantity(-5n, price, bps)).toBe(0n);
  });

  it("refuses a nonsensical price rather than dividing by it", () => {
    expect(() => affordableQuantity(100n, 0n, bps)).toThrow(MoneyError);
  });
});

describe("quantity as the database stores it", () => {
  it("round-trips through the decimal string form", () => {
    for (const text of [
      "0.0000",
      "1.0000",
      "12.3400",
      "-5.6789",
      "999999.9999",
    ]) {
      expect(quantityToDecimalString(quantityFromDecimalString(text))).toBe(
        text,
      );
    }
  });

  it("accepts the shorter forms Postgres may return", () => {
    expect(quantityFromDecimalString("12.34")).toBe(123_400n);
    expect(quantityFromDecimalString("7")).toBe(70_000n);
    expect(quantityFromDecimalString(" 7.5 ")).toBe(75_000n);
  });

  it("refuses precision it would have to throw away", () => {
    // Silently truncating here would lose something the database is holding.
    expect(() => quantityFromDecimalString("1.00001")).toThrow(MoneyError);
    expect(quantityFromDecimalString("1.00000")).toBe(10_000n);
  });

  it("refuses anything that is not a decimal", () => {
    for (const bad of ["", "abc", "1.2.3", "1e5", "NaN"]) {
      expect(() => quantityFromDecimalString(bad)).toThrow(MoneyError);
    }
  });
});
