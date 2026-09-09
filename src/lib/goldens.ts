/**
 * The golden runs (H17).
 *
 * A fixed scenario, a fixed sequence of decisions, and a committed expected
 * output. CI fails on any difference, which is the main defence against a
 * later edit quietly changing what a portfolio is worth. Regenerating one is a
 * deliberate act: `npm run engine:regenerate-goldens -- --confirm`, with the
 * reason in the commit message.
 *
 * The runs use the real snapshot rather than invented prices. A golden that
 * only ever saw tidy fixture data would not notice a valuation change that
 * only shows up on a real series with a carried-forward bar in it.
 */
import { join } from "node:path";
import { behaviourMetrics, shockOutcome } from "@/engine/behaviour";
import { debriefInputs } from "@/engine/counterfactuals";
import { deriveState } from "@/engine/ledger";
import { createPriceAccessor } from "@/engine/prices";
import { advanceStep, applyAction, createRun } from "@/engine/run";
import { canonicalJson } from "@/engine/serialise";
import type { RunState, StepPrices, Symbol_ } from "@/engine/types";
import { loadScenario } from "@/lib/scenarios";
import { loadSnapshotBars, snapshotStepDates } from "@/lib/snapshot-bars";

export const GOLDEN_DIR = join(process.cwd(), "src", "engine", "__goldens__");
export const GOLDEN_SCENARIO = { slug: "first-replay", version: 1 } as const;

/** A balanced opening mix: index, gold, gilts, and a few equities. */
const BALANCED: Record<Symbol_, number> = {
  NIFTYBEES: 3_500,
  GOLDBEES: 1_000,
  LTGILTBEES: 1_500,
  RELIANCE: 1_000,
  TCS: 1_000,
  INFY: 500,
  ICICIBANK: 500,
  HINDUNILVR: 500,
  CASH: 500,
};

/** The same money, tilted hard into equities and holding no cash. */
const AGGRESSIVE: Record<Symbol_, number> = {
  NIFTYBEES: 2_000,
  GOLDBEES: 500,
  LTGILTBEES: 500,
  RELIANCE: 1_800,
  TCS: 1_800,
  INFY: 1_200,
  ICICIBANK: 1_200,
  HINDUNILVR: 1_000,
};

export interface GoldenRun {
  readonly name: string;
  readonly description: string;
  readonly weightsFor: (step: number) => Record<Symbol_, number> | null;
}

export const GOLDEN_RUNS: readonly GoldenRun[] = [
  {
    name: "passive",
    description:
      "Deploys once at step 0 and never trades again. Income piles up in cash, " +
      "so the shock is absorbed without selling anything.",
    weightsFor: (step) => (step === 0 ? BALANCED : null),
  },
  {
    name: "active",
    description:
      "Rebalances every six months, alternating between the balanced and the " +
      "aggressive mix. Exercises sells funding buys, and pays for the churn.",
    weightsFor: (step) => {
      if (step % 6 !== 0) return null;
      return step % 12 === 0 ? BALANCED : AGGRESSIVE;
    },
  },
  {
    name: "shock-forces-a-sale",
    description:
      "Sweeps every rupee into the market each month, so no buffer is ever " +
      "built and the unplanned expense has to be met by selling.",
    weightsFor: () => AGGRESSIVE,
  },
];

export interface GoldenPayload {
  readonly run: string;
  readonly description: string;
  readonly scenario: {
    readonly name: string;
    readonly version: number;
    readonly seed: string;
    readonly snapshotVersion: number;
  };
  readonly finalStep: number;
  readonly shock: ReturnType<typeof shockOutcome>;
  readonly entries: RunState["entries"];
  readonly perStep: ReturnType<typeof deriveState>[];
  readonly counterfactuals: {
    readonly key: string;
    readonly label: string;
    readonly finalValuePaise: bigint;
  }[];
  readonly behaviour: ReturnType<typeof behaviourMetrics>;
}

/**
 * Plays one golden run and returns everything worth pinning: the full ledger,
 * the derived state at every step, both counterfactuals, and the behavioural
 * metrics. Anything the engine could change without one of these moving is
 * something the goldens would not catch.
 */
export function computeGolden(golden: GoldenRun): GoldenPayload {
  const config = loadScenario(GOLDEN_SCENARIO.slug, GOLDEN_SCENARIO.version);
  const source = loadSnapshotBars(config.universe, config.snapshotVersion);
  const stepDates = snapshotStepDates(
    source,
    config.window.start,
    config.window.end,
  );

  let run = createRun(config, stepDates);
  for (;;) {
    const weights =
      run.status === "in_progress" ? golden.weightsFor(run.currentStep) : null;
    if (weights !== null) {
      const result = applyAction(
        run,
        config,
        {
          type: "set_target_weights",
          idempotencyKey: `${golden.name}-step-${run.currentStep}`,
          weightsBps: weights,
        },
        createPriceAccessor(source, run),
      );
      if (result.rejection !== undefined) {
        throw new Error(
          `${golden.name}: step ${run.currentStep} rejected: ${result.rejection.message}`,
        );
      }
      run = result.runState;
    }
    if (run.currentStep >= run.finalStep) break;
    const advanced = advanceStep(run, config, {
      accessorFor: (state) => createPriceAccessor(source, state),
    });
    if (advanced.rejection !== undefined) {
      throw new Error(`${golden.name}: ${advanced.rejection.message}`);
    }
    run = advanced.runState;
  }

  // The run is complete, so every step is now readable.
  const accessor = createPriceAccessor(source, run);
  const pricesAt = (step: number): StepPrices => accessor.at(step);
  const debrief = debriefInputs(
    config,
    run.entries,
    pricesAt,
    run.finalStep,
    run.initialWeightsBps,
    {
      basis: "price_return",
      isAdjusted: true,
      adjustedAsOf: "2026-09-09",
      dividendsIncluded: false,
    },
  );

  return {
    run: golden.name,
    description: golden.description,
    scenario: {
      name: config.name,
      version: config.version,
      seed: config.seed,
      snapshotVersion: config.snapshotVersion,
    },
    finalStep: run.finalStep,
    shock: shockOutcome(run.entries),
    entries: run.entries,
    perStep: [...debrief.perStep],
    counterfactuals: debrief.counterfactuals.map((cf) => ({
      key: cf.key,
      label: cf.label,
      finalValuePaise: cf.finalValuePaise,
    })),
    behaviour: behaviourMetrics(run.entries, debrief.perStep),
  };
}

export function goldenPath(name: string): string {
  return join(GOLDEN_DIR, `${name}.json`);
}

export function renderGolden(payload: GoldenPayload): string {
  return `${canonicalJson(payload)}\n`;
}
