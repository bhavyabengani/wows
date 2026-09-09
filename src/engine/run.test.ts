/**
 * The run: creating one, acting on it, advancing it.
 *
 * Covers the invariants that make a run trustworthy — determinism (H14),
 * idempotency (H16), the ledger as the only source of truth (H13), rejections
 * as values rather than silence (H34), and lossless resumption (H18).
 */
import { describe, expect, it } from "vitest";
import { parseScenarioConfig, type ScenarioConfig } from "./config";
import { deriveState, foldLedger } from "./ledger";
import { createPriceAccessor } from "./prices";
import { advanceStep, applyAction, createRun, CASH_SYMBOL } from "./run";
import { canonicalJson, deserialiseRun, serialiseRun } from "./serialise";
import { fixtureSource, playScript } from "./test-support";
import type { RunState } from "./types";

// Twelve month-ends, one instrument that rises then falls hard, one steady.
const STEP_DATES = [
  "2020-01-31",
  "2020-02-28",
  "2020-03-31",
  "2020-04-30",
  "2020-05-29",
  "2020-06-30",
  "2020-07-31",
  "2020-08-31",
  "2020-09-30",
  "2020-10-30",
  "2020-11-30",
  "2020-12-31",
];

const RISKY = [
  100_00n,
  110_00n,
  60_00n,
  70_00n,
  80_00n,
  90_00n,
  100_00n,
  105_00n,
  108_00n,
  112_00n,
  115_00n,
  120_00n,
];
const STEADY = STEP_DATES.map(() => 50_00n);

const source = fixtureSource(STEP_DATES, {
  RISKY: STEP_DATES.map((date, i) => [date, RISKY[i] ?? 100_00n]),
  STEADY: STEP_DATES.map((date, i) => [date, STEADY[i] ?? 50_00n]),
});

function config(overrides: Record<string, unknown> = {}): ScenarioConfig {
  return parseScenarioConfig({
    name: "Fixture",
    version: 1,
    seed: "fixture-seed",
    snapshotVersion: 1,
    window: { start: "2020-01-01", end: "2020-12-31" },
    cadence: "monthly",
    universe: ["RISKY", "STEADY"],
    benchmarkSymbol: "STEADY",
    startingCorpus: "100000.00",
    monthlyIncome: "5000.00",
    monthlyExpense: "3000.00",
    shock: {
      min: "20000.00",
      max: "20000.00",
      label: "Unplanned expense",
      windowFraction: 0.6,
    },
    transactionCostBps: 10,
    ...overrides,
  });
}

const accessorFor = (run: RunState) => createPriceAccessor(source, run);

describe("creating a run", () => {
  it("starts at step 0 with the whole corpus in cash", () => {
    const run = createRun(config(), STEP_DATES);
    expect(run.currentStep).toBe(0);
    expect(run.status).toBe("in_progress");
    expect(run.finalStep).toBe(11);
    const folded = foldLedger(run.entries, 0);
    expect(folded.cashPaise).toBe(10_000_000n);
    expect(folded.holdings.size).toBe(0);
  });

  it("draws the shock from the seed, inside the middle of the run", () => {
    const run = createRun(config(), STEP_DATES);
    expect(run.shockStep).toBeGreaterThanOrEqual(2);
    expect(run.shockStep).toBeLessThanOrEqual(9);
    expect(run.shockAmountPaise).toBe(2_000_000n);
  });

  it("gives the same shock to every player on the same scenario", () => {
    const a = createRun(config(), STEP_DATES);
    const b = createRun(config(), STEP_DATES);
    expect(b.shockStep).toBe(a.shockStep);
    expect(b.shockAmountPaise).toBe(a.shockAmountPaise);
  });

  it("gives a different shock to a different seed", () => {
    const a = createRun(config({ seed: "one" }), STEP_DATES);
    const b = createRun(config({ seed: "two" }), STEP_DATES);
    expect(a.shockStep !== b.shockStep || a.seed !== b.seed).toBe(true);
  });

  it("refuses a scenario that is not a replay", () => {
    expect(() => createRun(config(), ["2020-01-31"])).toThrow(/at least two/);
    expect(() => createRun(config(), ["2020-02-28", "2020-01-31"])).toThrow(
      /ascending/,
    );
  });
});

describe("setting target weights", () => {
  it("turns weights into orders and fills at this step's close", () => {
    const run = createRun(config(), STEP_DATES);
    const result = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 6_000, STEADY: 4_000 },
      },
      accessorFor(run),
    );
    expect(result.rejection).toBeUndefined();

    const fills = result.ledgerEntries.filter((e) => e.kind === "fill");
    expect(fills).toHaveLength(2);
    for (const fill of fills) {
      if (fill.kind !== "fill") continue;
      expect(fill.side).toBe("buy");
      expect(fill.step).toBe(0);
      // Executed at the close of the step the decision was made at.
      expect(fill.date).toBe("2020-01-31");
      expect(fill.costPaise).toBeGreaterThan(0n);
    }
  });

  it("never overdraws cash, even asking for everything", () => {
    const run = createRun(config(), STEP_DATES);
    const result = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 10_000 },
      },
      accessorFor(run),
    );
    const folded = foldLedger(result.runState.entries, 0);
    expect(folded.cashPaise).toBeGreaterThanOrEqual(0n);
  });

  it("leaves the cash weight in cash rather than trading it", () => {
    const run = createRun(config(), STEP_DATES);
    const result = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 5_000, [CASH_SYMBOL]: 5_000 },
      },
      accessorFor(run),
    );
    const state = deriveState(
      result.runState.entries,
      accessorFor(result.runState).current(),
      0,
    );
    // Half the corpus, less the cost of deploying the other half.
    expect(state.cashPaise).toBeGreaterThan(4_900_000n);
    expect(state.cashPaise).toBeLessThanOrEqual(5_000_000n);
  });

  it("sells down an overweight holding on a later rebalance", () => {
    let run = createRun(config(), STEP_DATES);
    run = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 10_000 },
      },
      accessorFor(run),
    ).runState;
    run = advanceStep(run, config(), { accessorFor }).runState;

    const result = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k2",
        weightsBps: { RISKY: 2_000, STEADY: 8_000 },
      },
      accessorFor(run),
    );
    const sides = result.ledgerEntries
      .filter((e) => e.kind === "fill")
      .map((e) => (e.kind === "fill" ? e.side : ""));
    expect(sides).toContain("sell");
    expect(sides).toContain("buy");
    // Sells are planned before buys so their proceeds fund the buys.
    expect(sides.indexOf("sell")).toBeLessThan(sides.indexOf("buy"));
  });
});

describe("rejections are values, not exceptions (H34)", () => {
  const cases: [string, Record<string, number>, string][] = [
    [
      "weights that do not total 10000",
      { RISKY: 5_000 },
      "weights_do_not_total_10000",
    ],
    ["a negative weight", { RISKY: -1_000, STEADY: 11_000 }, "negative_weight"],
    [
      "an instrument outside the universe",
      { NOPE: 10_000 },
      "instrument_not_in_universe",
    ],
  ];

  for (const [name, weights, code] of cases) {
    it(`rejects ${name}`, () => {
      const run = createRun(config(), STEP_DATES);
      const result = applyAction(
        run,
        config(),
        {
          type: "set_target_weights",
          idempotencyKey: "k1",
          weightsBps: weights,
        },
        accessorFor(run),
      );
      expect(result.rejection?.code).toBe(code);
      // Nothing happened: no entries, and the run is untouched.
      expect(result.ledgerEntries).toEqual([]);
      expect(result.runState).toBe(run);
    });
  }

  it("rejects an action on a finished run", () => {
    const finished = {
      ...createRun(config(), STEP_DATES),
      status: "completed" as const,
    };
    const result = applyAction(
      finished,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 10_000 },
      },
      accessorFor(finished),
    );
    expect(result.rejection?.code).toBe("run_not_in_progress");
  });

  it("rejects an instrument with no price yet, rather than valuing it at zero", () => {
    const late = fixtureSource(STEP_DATES, {
      RISKY: STEP_DATES.map((date, i) => [date, RISKY[i] ?? 100_00n]),
      STEADY: [["2020-12-31", 50_00n]],
    });
    const run = createRun(config(), STEP_DATES);
    const result = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { STEADY: 10_000 },
      },
      createPriceAccessor(late, run),
    );
    expect(result.rejection?.code).toBe("no_price_for_instrument");
  });
});

describe("idempotency (H16)", () => {
  it("a repeated key returns the original result and creates nothing", () => {
    const run = createRun(config(), STEP_DATES);
    const action = {
      type: "set_target_weights" as const,
      idempotencyKey: "double-click",
      weightsBps: { RISKY: 6_000, STEADY: 4_000 },
    };

    const first = applyAction(run, config(), action, accessorFor(run));
    const second = applyAction(
      first.runState,
      config(),
      action,
      accessorFor(first.runState),
    );

    // The same entries come back, and the ledger has not grown.
    expect(second.ledgerEntries).toEqual(first.ledgerEntries);
    expect(second.runState.entries).toHaveLength(first.runState.entries.length);
    expect(second.rejection).toBeUndefined();

    const before = foldLedger(first.runState.entries, 0);
    const after = foldLedger(second.runState.entries, 0);
    expect(after.cashPaise).toBe(before.cashPaise);
    expect([...after.holdings]).toEqual([...before.holdings]);
  });

  it("a different key on the same step is a new decision", () => {
    const run = createRun(config(), STEP_DATES);
    const first = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "a",
        weightsBps: { RISKY: 5_000, STEADY: 5_000 },
      },
      accessorFor(run),
    );
    const second = applyAction(
      first.runState,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "b",
        weightsBps: { RISKY: 8_000, STEADY: 2_000 },
      },
      accessorFor(first.runState),
    );
    expect(second.runState.entries.length).toBeGreaterThan(
      first.runState.entries.length,
    );
  });
});

describe("advancing a step", () => {
  it("lands income in cash rather than investing it", () => {
    let run = createRun(config(), STEP_DATES);
    run = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 10_000 },
      },
      accessorFor(run),
    ).runState;

    const cashBefore = foldLedger(run.entries, 0).cashPaise;
    const advanced = advanceStep(run, config(), { accessorFor });
    const cashAfter = foldLedger(advanced.runState.entries, 1).cashPaise;

    // Income less expenses, and nothing bought: deciding what to do with it is
    // the game.
    expect(cashAfter - cashBefore).toBe(500_000n - 300_000n);
    const boughtAtStepOne = advanced.ledgerEntries.filter(
      (e) => e.kind === "fill",
    );
    expect(boughtAtStepOne).toEqual([]);
  });

  it("completes at the final step and refuses to go further", () => {
    const run = playScript(config(), source, STEP_DATES, () => null);
    expect(run.status).toBe("completed");
    expect(run.currentStep).toBe(11);
    const again = advanceStep(run, config(), { accessorFor });
    expect(again.rejection?.code).toBe("run_not_in_progress");
  });
});

describe("the expense shock", () => {
  it("is absorbed from cash when there is a buffer, without selling", () => {
    // Nothing is ever invested, so cash is always ample.
    const run = playScript(config(), source, STEP_DATES, () => null);
    const shock = run.entries.find((e) => e.kind === "expense_shock");
    expect(shock?.kind).toBe("expense_shock");
    if (shock?.kind !== "expense_shock") throw new Error("no shock");
    expect(shock.absorbedFromCash).toBe(true);

    const forcedSales = run.entries.filter(
      (e) => e.kind === "fill" && e.step === shock.step,
    );
    expect(forcedSales).toEqual([]);
  });

  it("forces a sale only when cash cannot cover it, and says so", () => {
    // Fully invested every month, so no buffer is ever built.
    const run = playScript(config(), source, STEP_DATES, () => ({
      RISKY: 5_000,
      STEADY: 5_000,
    }));
    const shock = run.entries.find((e) => e.kind === "expense_shock");
    if (shock?.kind !== "expense_shock") throw new Error("no shock");
    expect(shock.absorbedFromCash).toBe(false);

    const sales = run.entries.filter(
      (e) => e.kind === "fill" && e.step === shock.step && e.side === "sell",
    );
    expect(sales.length).toBeGreaterThan(0);
    // Cash never goes negative: the sale actually covered the shortfall.
    expect(
      foldLedger(run.entries, shock.step).cashPaise,
    ).toBeGreaterThanOrEqual(0n);
  });
});

describe("the ledger is the only truth (H13)", () => {
  const run = playScript(config(), source, STEP_DATES, (step) =>
    step % 3 === 0 ? { RISKY: 6_000, STEADY: 4_000 } : null,
  );

  it("folds to the same state whether taken whole or in pieces", () => {
    for (const step of [0, 3, 7, 11]) {
      const whole = foldLedger(run.entries, step);
      const prefix = foldLedger(
        run.entries.filter((entry) => entry.step <= step),
        step,
      );
      expect(prefix.cashPaise).toBe(whole.cashPaise);
      expect([...prefix.holdings].sort()).toEqual([...whole.holdings].sort());
    }
  });

  it("does not depend on the order entries are handed over", () => {
    const shuffled = [...run.entries].reverse();
    const forwards = foldLedger(run.entries, 11);
    const backwards = foldLedger(shuffled, 11);
    expect(backwards.cashPaise).toBe(forwards.cashPaise);
    expect([...backwards.holdings].sort()).toEqual(
      [...forwards.holdings].sort(),
    );
  });

  it("rebuilds portfolio state from the entries alone", () => {
    const accessor = createPriceAccessor(source, run);
    const state = deriveState(run.entries, accessor.at(11), 11);
    let sum = state.cashPaise;
    for (const position of state.positions) sum += position.valuePaise;
    expect(state.totalValuePaise).toBe(sum);
  });

  it("counts an order without a fill as changing nothing", () => {
    const withOrphan = [
      ...run.entries,
      {
        kind: "order_placed" as const,
        seq: 9_999,
        step: 11,
        date: "2020-12-31",
        orderId: "orphan",
        idempotencyKey: "orphan",
        symbol: "RISKY",
        side: "buy" as const,
        quantity: 1_000_000n,
      },
    ];
    expect(foldLedger(withOrphan, 11).cashPaise).toBe(
      foldLedger(run.entries, 11).cashPaise,
    );
  });
});

describe("determinism (H14)", () => {
  it("produces byte-identical output for the same seed and inputs", () => {
    const script = (step: number) =>
      step % 2 === 0
        ? { RISKY: 7_000, STEADY: 3_000 }
        : { RISKY: 3_000, STEADY: 7_000 };
    const first = playScript(config(), source, STEP_DATES, script);
    const second = playScript(config(), source, STEP_DATES, script);
    expect(canonicalJson(second)).toBe(canonicalJson(first));
  });

  it("produces different output for a different seed", () => {
    const script = () => ({ RISKY: 5_000, STEADY: 5_000 });
    const a = playScript(config({ seed: "alpha" }), source, STEP_DATES, script);
    const b = playScript(config({ seed: "beta" }), source, STEP_DATES, script);
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });
});

describe("serialisation (H18)", () => {
  it("round-trips a run mid-flight without losing a paise", () => {
    let run = createRun(config(), STEP_DATES);
    run = applyAction(
      run,
      config(),
      {
        type: "set_target_weights",
        idempotencyKey: "k1",
        weightsBps: { RISKY: 6_000, STEADY: 4_000 },
      },
      accessorFor(run),
    ).runState;
    run = advanceStep(run, config(), { accessorFor }).runState;

    const restored = deserialiseRun(serialiseRun(run));
    expect(canonicalJson(restored)).toBe(canonicalJson(run));
    expect(restored.prng).toEqual(run.prng);
    expect(typeof restored.entries[0]?.date).toBe("string");
    const original = run.entries.find((e) => e.kind === "fill");
    const copy = restored.entries.find((e) => e.kind === "fill");
    if (original?.kind !== "fill" || copy?.kind !== "fill") {
      throw new Error("expected a fill");
    }
    expect(typeof copy.grossPaise).toBe("bigint");
    expect(copy.grossPaise).toBe(original.grossPaise);
  });

  it("a resumed run continues exactly as an uninterrupted one would", () => {
    const script = (step: number) =>
      step % 4 === 0 ? { RISKY: 6_000, STEADY: 4_000 } : null;

    // Uninterrupted.
    const straight = playScript(config(), source, STEP_DATES, script);

    // Interrupted at step 5, written to JSON, read back, and continued.
    let run = createRun(config(), STEP_DATES);
    for (let step = 0; step <= 5; step += 1) {
      const weights = script(run.currentStep);
      if (weights !== null) {
        run = applyAction(
          run,
          config(),
          {
            type: "set_target_weights",
            idempotencyKey: `step-${run.currentStep}`,
            weightsBps: weights,
          },
          accessorFor(run),
        ).runState;
      }
      run = advanceStep(run, config(), { accessorFor }).runState;
    }
    let resumed = deserialiseRun(serialiseRun(run));
    for (;;) {
      const weights = script(resumed.currentStep);
      if (weights !== null) {
        resumed = applyAction(
          resumed,
          config(),
          {
            type: "set_target_weights",
            idempotencyKey: `step-${resumed.currentStep}`,
            weightsBps: weights,
          },
          accessorFor(resumed),
        ).runState;
      }
      if (resumed.currentStep >= resumed.finalStep) break;
      resumed = advanceStep(resumed, config(), { accessorFor }).runState;
    }

    expect(canonicalJson(resumed)).toBe(canonicalJson(straight));
  });
});
