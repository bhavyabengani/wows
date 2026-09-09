/**
 * The price accessor, which is where H15 lives.
 *
 * The client never receives future data because the server never reads it.
 * That is only true if asking for a future price is an error rather than a
 * value, so that is what these tests check first.
 */
import { describe, expect, it } from "vitest";
import {
  createPriceAccessor,
  FuturePriceError,
  MissingPriceError,
  monthlyStepDates,
} from "./prices";
import { fixtureSource } from "./test-support";

const CALENDAR = [
  "2020-01-31",
  "2020-02-28",
  "2020-03-31",
  "2020-04-30",
  "2020-05-29",
];

const source = fixtureSource(CALENDAR, {
  ACME: [
    ["2020-01-31", 10_000n],
    ["2020-02-28", 11_000n],
    // No bar in March: the instrument did not trade, or the row was removed.
    ["2020-04-30", 9_000n],
    ["2020-05-29", 9_500n],
  ],
  THIN: [["2020-01-31", 5_000n]],
});

const run = { currentStep: 2, stepDates: CALENDAR };

describe("the accessor is bounded by the run's current step (H15)", () => {
  it("returns prices up to and including the current step", () => {
    const accessor = createPriceAccessor(source, run);
    expect(accessor.at(0).close("ACME").closePaise).toBe(10_000n);
    expect(accessor.at(1).close("ACME").closePaise).toBe(11_000n);
    expect(accessor.current().step).toBe(2);
  });

  it("throws rather than returning anything for a future step", () => {
    const accessor = createPriceAccessor(source, run);
    expect(() => accessor.at(3)).toThrow(FuturePriceError);
    expect(() => accessor.at(4)).toThrow(FuturePriceError);
    // Far beyond the run entirely.
    expect(() => accessor.at(99)).toThrow(FuturePriceError);
  });

  it("throws for a nonsensical step rather than coercing it", () => {
    const accessor = createPriceAccessor(source, run);
    expect(() => accessor.at(-1)).toThrow(FuturePriceError);
    expect(() => accessor.at(1.5)).toThrow(FuturePriceError);
    expect(() => accessor.at(Number.NaN)).toThrow(FuturePriceError);
  });

  it("exposes no way to reach a series, so there is nothing to slice", () => {
    const accessor = createPriceAccessor(source, run);
    const step = accessor.at(0);
    expect(Object.keys(step).sort()).toEqual(["close", "date", "has", "step"]);
  });

  it("moves its bound only when the run moves", () => {
    const earlier = createPriceAccessor(source, { ...run, currentStep: 0 });
    expect(() => earlier.at(1)).toThrow(FuturePriceError);
    const later = createPriceAccessor(source, { ...run, currentStep: 1 });
    expect(later.at(1).close("ACME").closePaise).toBe(11_000n);
  });
});

describe("a missing bar carries forward", () => {
  const accessor = createPriceAccessor(source, {
    currentStep: 4,
    stepDates: CALENDAR,
  });

  it("uses the previous close and says that it did", () => {
    const quote = accessor.at(2).close("ACME"); // March, no bar
    expect(quote.closePaise).toBe(11_000n);
    expect(quote.synthetic).toBe(true);
    expect(quote.date).toBe("2020-03-31");
    // The date the price actually came from, so a run stays auditable.
    expect(quote.asOfDate).toBe("2020-02-28");
  });

  it("marks a real bar as not synthetic", () => {
    const quote = accessor.at(1).close("ACME");
    expect(quote.synthetic).toBe(false);
    expect(quote.asOfDate).toBe(quote.date);
  });

  it("carries forward across a long gap for a thinly traded instrument", () => {
    const quote = accessor.at(4).close("THIN");
    expect(quote.closePaise).toBe(5_000n);
    expect(quote.synthetic).toBe(true);
    expect(quote.asOfDate).toBe("2020-01-31");
  });

  it("throws when there is no earlier close to carry", () => {
    const late = fixtureSource(CALENDAR, {
      LATE: [["2020-05-29", 100n]],
    });
    const lateAccessor = createPriceAccessor(late, {
      currentStep: 4,
      stepDates: CALENDAR,
    });
    expect(() => lateAccessor.at(0).close("LATE")).toThrow(MissingPriceError);
    expect(lateAccessor.at(0).has("LATE")).toBe(false);
    expect(lateAccessor.at(4).has("LATE")).toBe(true);
  });

  it("throws for an instrument it has never heard of", () => {
    expect(() => accessor.at(0).close("NOPE")).toThrow(MissingPriceError);
  });
});

describe("monthly steps land on the last trading day of each month", () => {
  it("takes the calendar's own last day, never a fixed date", () => {
    const calendar = [
      "2020-01-30",
      "2020-01-31",
      "2020-02-27",
      "2020-02-28",
      "2020-03-31",
    ];
    expect(monthlyStepDates(calendar, "2020-01-01", "2020-03-31")).toEqual([
      "2020-01-31",
      "2020-02-28",
      "2020-03-31",
    ]);
  });

  it("respects the window's edges", () => {
    const calendar = ["2019-12-31", "2020-01-31", "2020-02-28"];
    expect(monthlyStepDates(calendar, "2020-01-01", "2020-01-31")).toEqual([
      "2020-01-31",
    ]);
  });

  it("returns nothing when the window contains no trading day", () => {
    expect(monthlyStepDates(CALENDAR, "2021-01-01", "2021-12-31")).toEqual([]);
  });
});
