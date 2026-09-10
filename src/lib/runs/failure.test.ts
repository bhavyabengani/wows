/**
 * A failed action surfaces (H34).
 *
 * The dangerous shape is not a crash; it is a handler that catches something,
 * logs it, and returns a body the screen renders as success. These tests fix
 * the two places that could happen: the repository must return a rejection
 * rather than a run state, and the debrief's copy must never be built from a
 * value it did not get.
 */
import { describe, expect, it } from "vitest";
import { parseScenarioConfig } from "@/engine/config";
import { createPriceAccessor } from "@/engine/prices";
import { applyAction, createRun } from "@/engine/run";
import { fixtureSource } from "@/engine/test-support";
import { selectFinding, shockSentence } from "./debrief";
import type { BehaviourMetrics } from "@/engine/behaviour";

const STEP_DATES = ["2020-01-31", "2020-02-28", "2020-03-31"];
const source = fixtureSource(STEP_DATES, {
  ACME: STEP_DATES.map((date) => [date, 10_000n] as [string, bigint]),
});

const config = parseScenarioConfig({
  name: "Fixture",
  version: 1,
  seed: "s",
  snapshotVersion: 1,
  window: { start: "2020-01-01", end: "2020-03-31" },
  cadence: "monthly",
  universe: ["ACME"],
  benchmarkSymbol: "ACME",
  startingCorpus: "100000.00",
  monthlyIncome: "0.00",
  monthlyExpense: "0.00",
  shock: {
    min: "0.00",
    max: "0.00",
    label: "Unplanned expense",
    windowFraction: 0.6,
  },
  transactionCostBps: 10,
});

describe("a rejected action returns a rejection, never a state", () => {
  it("changes nothing and says why", () => {
    const run = createRun(config, STEP_DATES);
    const result = applyAction(
      run,
      config,
      {
        type: "set_target_weights",
        idempotencyKey: "k",
        // Deliberately short of 10000: the kind of thing a slider bug produces.
        weightsBps: { ACME: 9_000 },
      },
      createPriceAccessor(source, run),
    );

    expect(result.rejection).toBeDefined();
    expect(result.rejection?.code).toBe("weights_do_not_total_10000");
    // The message has to be something a screen can show a member.
    expect(result.rejection?.message).toMatch(/10000/);
    // And nothing may have happened.
    expect(result.ledgerEntries).toEqual([]);
    expect(result.runState).toBe(run);
  });

  it("never silently normalises an allocation that does not add up", () => {
    const run = createRun(config, STEP_DATES);
    const under = applyAction(
      run,
      config,
      {
        type: "set_target_weights",
        idempotencyKey: "a",
        weightsBps: { ACME: 9_900 },
      },
      createPriceAccessor(source, run),
    );
    const over = applyAction(
      run,
      config,
      {
        type: "set_target_weights",
        idempotencyKey: "b",
        weightsBps: { ACME: 10_100 },
      },
      createPriceAccessor(source, run),
    );
    expect(under.rejection?.code).toBe("weights_do_not_total_10000");
    expect(over.rejection?.code).toBe("weights_do_not_total_10000");
  });
});

describe("the debrief describes and never prescribes", () => {
  const quiet: BehaviourMetrics = {
    overTrading: {
      turnoverPaise: 0n,
      turnoverBps: 0,
      tradeCount: 0,
      reversalCount: 0,
      reversalWindowSteps: 2,
      costPaise: 0n,
    },
    panicSelling: {
      episodes: [],
      drawdownThresholdBps: 1_000,
      minimumSaleBps: 1_000,
    },
    concentration: {
      timeWeightedMaxBps: 1_000,
      peakBps: 1_500,
      peakStep: 1,
      peakSymbol: "ACME",
    },
  };

  /** Turnover nine times the benchmark: a deviation of 8. */
  const churned: BehaviourMetrics = {
    ...quiet,
    overTrading: { ...quiet.overTrading, turnoverBps: 90_000, tradeCount: 40 },
  };

  /** One panic episode, and turnover only just past its benchmark. */
  const panicked: BehaviourMetrics = {
    ...quiet,
    overTrading: { ...quiet.overTrading, turnoverBps: 11_000, tradeCount: 5 },
    panicSelling: {
      episodes: [{ step: 2, drawdownBps: 2_500, soldValuePaise: 500_000n }],
      drawdownThresholdBps: 1_000,
      minimumSaleBps: 1_000,
    },
  };

  /**
   * Turnover exactly twice its benchmark is a deviation of 1, and one panic
   * episode is also 1. The documented order decides, and it puts panic first.
   */
  const tied: BehaviourMetrics = {
    ...panicked,
    overTrading: { ...quiet.overTrading, turnoverBps: 20_000, tradeCount: 9 },
  };

  /** Words that would turn a description into advice. */
  const PRESCRIPTIVE =
    /\b(should|shouldn't|ought|must|better to|instead you|try to|avoid|recommend|advise|consider)\b/i;

  it("says plainly when nothing stands out, rather than inventing a finding", () => {
    const finding = selectFinding(quiet, []);
    expect(finding.key).toBe("nothing_stands_out");
    expect(finding.sentence).toMatch(/stands out/);
  });

  it("picks the metric furthest past its benchmark", () => {
    // Nine times the turnover benchmark is a deviation of 8; one panic episode
    // is a deviation of 1. The bigger one is the one worth a sentence.
    expect(selectFinding(churned, []).key).toBe("over_trading");
    expect(selectFinding(panicked, []).key).toBe("panic_selling");
    expect(selectFinding(panicked, []).sentence).toMatch(/sold/);
  });

  it("breaks an exact tie in the documented order", () => {
    // Both deviations are 1. Panic selling is first in the order, and the
    // order exists so that this is reproducible rather than incidental.
    expect(selectFinding(tied, []).key).toBe("panic_selling");
  });

  it("emits no sentence that tells the member what they should have done", () => {
    for (const metrics of [quiet, churned, panicked, tied]) {
      const finding = selectFinding(metrics, []);
      expect(finding.sentence).not.toMatch(PRESCRIPTIVE);
      expect(finding.method).not.toMatch(PRESCRIPTIVE);
    }
    for (const absorbed of [true, false]) {
      const sentence = shockSentence(
        true,
        absorbed,
        1_000_000n,
        "March 2020",
        absorbed ? 0n : 900_000n,
      );
      expect(sentence).not.toMatch(PRESCRIPTIVE);
    }
  });

  it("says which way the shock went, because that contrast is the lesson", () => {
    expect(shockSentence(true, true, 1_000_000n, "March 2020", 0n)).toMatch(
      /nothing was sold/,
    );
    expect(
      shockSentence(true, false, 1_000_000n, "March 2020", 900_000n),
    ).toMatch(/were sold/);
    expect(shockSentence(false, false, 0n, "", 0n)).toMatch(/No unplanned/);
  });
});
