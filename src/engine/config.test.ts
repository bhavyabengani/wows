/**
 * The scenario config schema.
 *
 * A scenario is a named, seeded, versioned config (H6), and a malformed one
 * has to fail at load rather than halfway through somebody's run. These tests
 * are mostly about what the schema *refuses*.
 */
import { describe, expect, it } from "vitest";
import {
  newsForStep,
  parseScenarioConfig,
  ScenarioConfigError,
} from "./config";

const VALID = {
  name: "Fixture",
  version: 1,
  seed: "fixture-seed",
  snapshotVersion: 1,
  window: { start: "2019-01-01", end: "2023-12-31" },
  cadence: "monthly",
  universe: ["NIFTYBEES", "GOLDBEES"],
  benchmarkSymbol: "NIFTYBEES",
  startingCorpus: "500000.00",
  monthlyIncome: "25000.00",
  monthlyExpense: "18000.00",
  shock: {
    min: "60000.00",
    max: "120000.00",
    label: "Unplanned expense",
    windowFraction: 0.6,
  },
  transactionCostBps: 10,
};

describe("parsing a scenario config", () => {
  it("accepts a well-formed config", () => {
    const config = parseScenarioConfig(VALID);
    expect(config.name).toBe("Fixture");
    expect(config.version).toBe(1);
    expect(config.news).toEqual([]);
  });

  it("turns rupee strings into integer paise", () => {
    const config = parseScenarioConfig(VALID);
    expect(config.startingCorpus).toBe(50_000_000n);
    expect(config.monthlyIncome).toBe(2_500_000n);
    expect(config.shock.max).toBe(12_000_000n);
    expect(typeof config.startingCorpus).toBe("bigint");
  });

  it("accepts rupees written without paise", () => {
    const config = parseScenarioConfig({ ...VALID, startingCorpus: "500000" });
    expect(config.startingCorpus).toBe(50_000_000n);
  });

  it("refuses money written as a JSON number", () => {
    // A JSON number is a double, so a config that wrote paise as a number
    // would be one edit away from losing precision silently.
    expect(() =>
      parseScenarioConfig({ ...VALID, startingCorpus: 500000 }),
    ).toThrow(ScenarioConfigError);
  });

  it("refuses money finer than a paise", () => {
    expect(() =>
      parseScenarioConfig({ ...VALID, startingCorpus: "500000.001" }),
    ).toThrow(ScenarioConfigError);
  });

  it("refuses a benchmark outside the universe", () => {
    expect(() =>
      parseScenarioConfig({ ...VALID, benchmarkSymbol: "TCS" }),
    ).toThrow(/not in the universe/);
  });

  it("refuses a universe that repeats a symbol", () => {
    expect(() =>
      parseScenarioConfig({
        ...VALID,
        universe: ["NIFTYBEES", "GOLDBEES", "NIFTYBEES"],
      }),
    ).toThrow(/repeats a symbol/);
  });

  it("refuses a window that ends before it starts", () => {
    expect(() =>
      parseScenarioConfig({
        ...VALID,
        window: { start: "2023-12-31", end: "2019-01-01" },
      }),
    ).toThrow(/ends before/);
  });

  it("refuses an inverted shock range", () => {
    expect(() =>
      parseScenarioConfig({
        ...VALID,
        shock: { ...VALID.shock, min: "120000.00", max: "60000.00" },
      }),
    ).toThrow(/below shock min/);
  });

  it("refuses a cadence it does not implement", () => {
    // Better to fail than to quietly run a weekly scenario as if monthly.
    expect(() => parseScenarioConfig({ ...VALID, cadence: "weekly" })).toThrow(
      ScenarioConfigError,
    );
  });

  it("refuses a version below one", () => {
    expect(() => parseScenarioConfig({ ...VALID, version: 0 })).toThrow(
      ScenarioConfigError,
    );
  });

  it("names every problem it found, not just the first", () => {
    let message = "";
    try {
      parseScenarioConfig({ ...VALID, version: 0, seed: "" });
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toMatch(/version/);
    expect(message).toMatch(/seed/);
  });
});

describe("news cards", () => {
  const withNews = {
    ...VALID,
    news: [
      {
        step: 3,
        dateline: "29 March 2019",
        headline: "A thing happened",
        body: "It happened.",
        source: "Replay wire",
      },
    ],
  };

  it("finds the card for a step", () => {
    const config = parseScenarioConfig(withNews);
    expect(newsForStep(config, 3)?.headline).toBe("A thing happened");
  });

  it("treats a step with no card as normal, not missing", () => {
    // The engine has to run before the sixty cards exist.
    const config = parseScenarioConfig(withNews);
    expect(newsForStep(config, 4)).toBeUndefined();
    expect(newsForStep(parseScenarioConfig(VALID), 0)).toBeUndefined();
  });

  it("refuses a card with an empty headline or no source", () => {
    expect(() =>
      parseScenarioConfig({
        ...withNews,
        news: [{ ...withNews.news[0], headline: "" }],
      }),
    ).toThrow(ScenarioConfigError);
    expect(() =>
      parseScenarioConfig({
        ...withNews,
        news: [{ ...withNews.news[0], source: "" }],
      }),
    ).toThrow(ScenarioConfigError);
  });
});
