/**
 * Golden-file tests (H17).
 *
 * A fixed scenario, a fixed sequence of decisions, and a committed expected
 * output covering the full ledger, the derived state at every step, both
 * counterfactuals and the behavioural metrics. Any change to the engine that
 * moves a number fails here.
 *
 * This is the main defence against a later edit quietly changing what a
 * portfolio is worth, so the failure message points at the deliberate path
 * rather than tempting anyone to regenerate on reflex.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_RUNS,
  computeGolden,
  goldenPath,
  renderGolden,
} from "@/lib/goldens";

const HINT = [
  "",
  "The engine no longer produces what this golden file records.",
  "If you did not mean to change valuation, ordering, costs or scoring, this is a bug.",
  "If you did, regenerate deliberately and say why in the commit message:",
  "  npm run engine:regenerate-goldens -- --confirm",
].join("\n");

describe("golden runs", () => {
  for (const golden of GOLDEN_RUNS) {
    it(`${golden.name} matches its committed output`, () => {
      const expected = readFileSync(goldenPath(golden.name), "utf8");
      const actual = renderGolden(computeGolden(golden));
      expect(actual, `${golden.name}${HINT}`).toBe(expected);
    }, 60_000);
  }

  it("covers a passive run, an active one, and a forced sale", () => {
    // The three shapes the brief asks for. A golden suite that only ever held
    // still would not exercise selling, cost, or the shock at all.
    const outcomes = GOLDEN_RUNS.map((golden) => {
      const payload = JSON.parse(
        readFileSync(goldenPath(golden.name), "utf8"),
      ) as {
        shock: { absorbedFromCash: boolean; occurred: boolean };
        behaviour: { overTrading: { tradeCount: number } };
      };
      return {
        name: golden.name,
        trades: payload.behaviour.overTrading.tradeCount,
        absorbed: payload.shock.absorbedFromCash,
        shocked: payload.shock.occurred,
      };
    });

    // Every run meets the shock.
    expect(outcomes.every((o) => o.shocked)).toBe(true);
    // One holds still after deploying, and its buffer absorbs the shock.
    expect(outcomes.some((o) => o.trades === 0 && o.absorbed)).toBe(true);
    // At least one trades through the run.
    expect(outcomes.some((o) => o.trades > 20)).toBe(true);
    // At least one has no buffer and has to sell.
    expect(outcomes.some((o) => !o.absorbed)).toBe(true);
  });

  it("is reproducible: computing a golden twice gives the same bytes", () => {
    const golden = GOLDEN_RUNS[0];
    if (golden === undefined) throw new Error("no golden runs");
    expect(renderGolden(computeGolden(golden))).toBe(
      renderGolden(computeGolden(golden)),
    );
  }, 60_000);
});
