/**
 * Fixtures for the engine's tests.
 *
 * Kept out of the engine's own boundary on purpose: this file reads the
 * committed snapshot from disk, which the engine itself must never do. The
 * architecture test excludes it by name and would fail if `src/engine`
 * proper ever grew an import like these.
 *
 * Golden runs use the real snapshot rather than invented prices, because a
 * golden that only ever saw synthetic data would not notice a valuation
 * change that showed up on real bars.
 */
import { createBarSource, createPriceAccessor } from "./prices";
import * as engineRun from "./run";
import type { BarSource, IsoDate, Symbol_ } from "./types";

interface Bar {
  date: IsoDate;
  closePaise: bigint;
}

/**
 * A tiny hand-built source, for tests that care about one rule rather than
 * about real market history.
 */
export function fixtureSource(
  calendar: readonly IsoDate[],
  series: Record<Symbol_, [IsoDate, bigint][]>,
): BarSource {
  const bars = new Map<Symbol_, Bar[]>();
  for (const [symbol, entries] of Object.entries(series)) {
    bars.set(
      symbol,
      entries.map(([date, closePaise]) => ({ date, closePaise })),
    );
  }
  return createBarSource(calendar, bars);
}

/**
 * Plays a whole run from a script, the way a player would: decide, advance,
 * decide again. `weightsFor` returns the weights to set at a step, or null to
 * leave the portfolio alone that month.
 */
export function playScript(
  config: import("./config").ScenarioConfig,
  source: BarSource,
  stepDates: readonly IsoDate[],
  weightsFor: (step: number) => Record<Symbol_, number> | null,
): import("./types").RunState {
  const { createRun, applyAction, advanceStep } = engineRun;
  let run = createRun(config, stepDates);

  for (;;) {
    // The final step is a valuation step: arriving at it completes the run, so
    // there is nothing left to decide there (docs/ENGINE_RULES.md).
    const weights =
      run.status === "in_progress" ? weightsFor(run.currentStep) : null;
    if (weights !== null) {
      const accessor = createPriceAccessor(source, run);
      const result = applyAction(
        run,
        config,
        {
          type: "set_target_weights",
          idempotencyKey: `step-${run.currentStep}`,
          weightsBps: weights,
        },
        accessor,
      );
      if (result.rejection !== undefined) {
        throw new Error(
          `step ${run.currentStep} rejected: ${result.rejection.message}`,
        );
      }
      run = result.runState;
    }

    if (run.currentStep >= run.finalStep) break;
    const advanced = advanceStep(run, config, {
      accessorFor: (state) => createPriceAccessor(source, state),
    });
    if (advanced.rejection !== undefined) {
      throw new Error(`advance rejected: ${advanced.rejection.message}`);
    }
    run = advanced.runState;
  }
  return run;
}
