/**
 * Everything the debrief screen needs, computed once, server-side.
 *
 * The engine does the arithmetic; this assembles it and attaches the
 * provenance a screen needs in order to be honest about what it is showing:
 * prices adjusted to a fetch date, every series price-return, and any step
 * whose valuation used a carried-forward close.
 */
import { eq } from "drizzle-orm";
import { formatMonthInIST } from "@/lib/time";
import type { Tx } from "@/db/client";
import { snapshots } from "@/db/schema";
import { behaviourMetrics, shockOutcome } from "@/engine/behaviour";
import { debriefInputs } from "@/engine/counterfactuals";
import { createPriceAccessor } from "@/engine/prices";
import type { StepPrices } from "@/engine/types";
import { loadBarSource } from "./price-source";
import { selectFinding, shockSentence, type Finding } from "./debrief";
import type { LoadedRun } from "./repository";

export interface TimelinePoint {
  readonly step: number;
  readonly date: string;
  readonly valuePaise: string;
  readonly trades: number;
  readonly shock: boolean;
  readonly news: boolean;
  readonly synthetic: boolean;
}

export interface DebriefView {
  readonly runId: string;
  readonly mode: "ranked" | "practice";
  readonly scenarioName: string;
  readonly finalValuePaise: string;
  readonly startingCorpusPaise: string;
  readonly counterfactuals: readonly {
    readonly key: string;
    readonly label: string;
    readonly finalValuePaise: string;
  }[];
  /** The lead figure: player against "did nothing". */
  readonly gapToDidNothingPaise: string;
  readonly gapToDidNothingBps: number;
  /**
   * True when the player never traded after their opening allocation, so they
   * *are* the "did nothing" comparison. A bare zero would read as a bug.
   */
  readonly neverTradedAfterOpening: boolean;
  readonly finding: Finding;
  readonly shock: {
    readonly sentence: string;
    readonly absorbedFromCash: boolean;
    readonly occurred: boolean;
  };
  readonly timeline: readonly TimelinePoint[];
  readonly metrics: ReturnType<typeof behaviourMetrics>;
  readonly trades: readonly {
    readonly step: number;
    readonly date: string;
    readonly symbol: string;
    readonly side: string;
    readonly grossPaise: string;
    readonly costPaise: string;
  }[];
  /** How to read every rupee figure on the screen. */
  readonly priceBasis: {
    readonly basis: string;
    readonly isAdjusted: boolean;
    readonly adjustedAsOf: string;
    readonly dividendsIncluded: boolean;
    readonly usedSyntheticPrices: boolean;
  };
}

export async function buildDebrief(
  tx: Tx,
  loaded: LoadedRun,
): Promise<DebriefView> {
  const { state, config } = loaded;

  const snapshotRows = await tx
    .select({
      isAdjusted: snapshots.isAdjusted,
      adjustedAsOf: snapshots.adjustedAsOf,
      priceBasis: snapshots.priceBasis,
      dividendsIncluded: snapshots.dividendsIncluded,
    })
    .from(snapshots)
    .where(eq(snapshots.version, config.snapshotVersion))
    .limit(1);
  const snapshot = snapshotRows[0];

  const source = await loadBarSource(tx, {
    symbols: config.universe,
    snapshotVersion: config.snapshotVersion,
    // The run is over, so every step of it is now legitimately readable.
    upToDate: state.stepDates[state.finalStep] ?? config.window.end,
  });
  const accessor = createPriceAccessor(source, state);
  const pricesAt = (step: number): StepPrices => accessor.at(step);

  const inputs = debriefInputs(
    config,
    state.entries,
    pricesAt,
    state.finalStep,
    state.initialWeightsBps,
    {
      basis: snapshot?.priceBasis ?? "price_return",
      isAdjusted: snapshot?.isAdjusted ?? true,
      adjustedAsOf: snapshot?.adjustedAsOf ?? "unknown",
      dividendsIncluded: snapshot?.dividendsIncluded ?? false,
    },
  );
  const metrics = behaviourMetrics(state.entries, inputs.perStep);
  const shock = shockOutcome(state.entries);

  const didNothing = inputs.counterfactuals.find(
    (cf) => cf.key === "did_nothing",
  );
  const gap = inputs.finalValuePaise - (didNothing?.finalValuePaise ?? 0n);
  const gapBps =
    didNothing && didNothing.finalValuePaise > 0n
      ? Number((gap * 10_000n) / didNothing.finalValuePaise)
      : 0;

  const tradesByStep = new Map<number, number>();
  const soldAtShock = state.entries
    .filter(
      (entry) =>
        entry.kind === "fill" &&
        entry.side === "sell" &&
        entry.step === shock.step,
    )
    .reduce(
      (sum, entry) => sum + (entry.kind === "fill" ? entry.grossPaise : 0n),
      0n,
    );
  for (const entry of state.entries) {
    if (entry.kind !== "fill") continue;
    tradesByStep.set(entry.step, (tradesByStep.get(entry.step) ?? 0) + 1);
  }
  const newsSteps = new Set(config.news.map((card) => card.step));

  const timeline: TimelinePoint[] = inputs.perStep.map((point) => ({
    step: point.step,
    date: point.date,
    valuePaise: String(point.totalValuePaise),
    trades: tradesByStep.get(point.step) ?? 0,
    shock: shock.occurred && shock.step === point.step,
    news: newsSteps.has(point.step),
    synthetic: point.usedSyntheticPrices,
  }));

  const shockDate = inputs.perStep.find(
    (point) => point.step === shock.step,
  )?.date;
  const shockWhen =
    shockDate === undefined
      ? "the run"
      : formatMonthInIST(`${shockDate}T00:00:00Z`);

  return {
    runId: loaded.runId,
    mode: loaded.mode,
    scenarioName: state.scenarioName,
    finalValuePaise: String(inputs.finalValuePaise),
    startingCorpusPaise: String(inputs.startingCorpusPaise),
    counterfactuals: inputs.counterfactuals.map((cf) => ({
      key: cf.key,
      label: cf.label,
      finalValuePaise: String(cf.finalValuePaise),
    })),
    gapToDidNothingPaise: String(gap),
    gapToDidNothingBps: gapBps,
    neverTradedAfterOpening: metrics.overTrading.tradeCount === 0,
    finding: selectFinding(metrics, inputs.perStep),
    shock: {
      sentence: shockSentence(
        shock.occurred,
        shock.absorbedFromCash,
        shock.amountPaise,
        shockWhen,
        soldAtShock,
      ),
      absorbedFromCash: shock.absorbedFromCash,
      occurred: shock.occurred,
    },
    timeline,
    metrics,
    trades: state.entries
      .filter(
        (entry): entry is Extract<typeof entry, { kind: "fill" }> =>
          entry.kind === "fill",
      )
      .map((fill) => ({
        step: fill.step,
        date: fill.date,
        symbol: fill.symbol,
        side: fill.side,
        grossPaise: String(fill.grossPaise),
        costPaise: String(fill.costPaise),
      })),
    priceBasis: inputs.priceBasis,
  };
}
