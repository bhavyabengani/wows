/**
 * Behavioural metrics for the debrief.
 *
 * Every one is a pure function over the ledger with a definition written down
 * in docs/ENGINE_RULES.md, so a member who disagrees with a number can be
 * shown exactly how it was reached. Nothing here calls a model: the non-goals
 * forbid AI-generated analysis presented as club output, and feedback given in
 * the club's name has to be reproducible and explainable.
 */
import { valueOf, type Paise } from "./money";
import type { LedgerEntry, PortfolioState, Symbol_ } from "./types";

export interface OverTrading {
  /** Gross value of all trades after the opening deployment. */
  readonly turnoverPaise: Paise;
  /** Turnover as a fraction of mean portfolio value, in basis points. */
  readonly turnoverBps: number;
  readonly tradeCount: number;
  /** Trades reversing the previous direction in the same instrument, within the window. */
  readonly reversalCount: number;
  readonly reversalWindowSteps: number;
  /** Total transaction cost paid, the part of over-trading a member can feel. */
  readonly costPaise: Paise;
}

export interface PanicSelling {
  /** Steps where risk was cut while the portfolio was well below its peak. */
  readonly episodes: readonly {
    readonly step: number;
    readonly drawdownBps: number;
    readonly soldValuePaise: Paise;
  }[];
  readonly drawdownThresholdBps: number;
  readonly minimumSaleBps: number;
}

export interface Concentration {
  /** Mean across steps of the largest single holding's weight, in basis points. */
  readonly timeWeightedMaxBps: number;
  readonly peakBps: number;
  readonly peakStep: number;
  readonly peakSymbol: Symbol_ | null;
}

export interface BehaviourMetrics {
  readonly overTrading: OverTrading;
  readonly panicSelling: PanicSelling;
  readonly concentration: Concentration;
}

export interface BehaviourOptions {
  /** A reversal must follow the opposite trade within this many steps. */
  readonly reversalWindowSteps?: number;
  /** How far below the trailing peak counts as a drawdown. */
  readonly drawdownThresholdBps?: number;
  /** How large a sale has to be, against portfolio value, to count. */
  readonly minimumSaleBps?: number;
}

const DEFAULTS = {
  reversalWindowSteps: 2,
  drawdownThresholdBps: 1_000,
  minimumSaleBps: 1_000,
} as const;

function fills(entries: readonly LedgerEntry[]) {
  return entries.filter(
    (entry): entry is Extract<LedgerEntry, { kind: "fill" }> =>
      entry.kind === "fill",
  );
}

/**
 * Turnover after the opening deployment, over mean portfolio value.
 *
 * Step 0's trades are excluded on purpose: deploying the corpus is not
 * trading, it is starting, and counting it would hand a buy-and-hold player a
 * turnover figure they never earned. Its cost is still counted, because the
 * player did pay it.
 */
export function overTrading(
  entries: readonly LedgerEntry[],
  perStep: readonly PortfolioState[],
  options: BehaviourOptions = {},
): OverTrading {
  const window = options.reversalWindowSteps ?? DEFAULTS.reversalWindowSteps;
  const all = fills(entries);
  const after = all.filter((fill) => fill.step > 0);

  let turnover = 0n;
  let cost = 0n;
  for (const fill of after) turnover += fill.grossPaise;
  for (const fill of all) cost += fill.costPaise;

  let meanValue = 0n;
  if (perStep.length > 0) {
    let sum = 0n;
    for (const state of perStep) sum += state.totalValuePaise;
    meanValue = sum / BigInt(perStep.length);
  }

  const lastSide = new Map<Symbol_, { side: string; step: number }>();
  let reversals = 0;
  for (const fill of [...after].sort((a, b) => a.seq - b.seq)) {
    const previous = lastSide.get(fill.symbol);
    if (
      previous !== undefined &&
      previous.side !== fill.side &&
      fill.step - previous.step <= window
    ) {
      reversals += 1;
    }
    lastSide.set(fill.symbol, { side: fill.side, step: fill.step });
  }

  return {
    turnoverPaise: turnover,
    turnoverBps: meanValue > 0n ? Number((turnover * 10_000n) / meanValue) : 0,
    tradeCount: after.length,
    reversalCount: reversals,
    reversalWindowSteps: window,
    costPaise: cost,
  };
}

/**
 * Selling heavily while the portfolio is well below its own trailing peak.
 *
 * Deliberately uses only what was knowable at the step itself. A test of the
 * form "and it recovered afterwards" would judge the player by hindsight they
 * did not have; what is being measured is the decision, not the outcome.
 */
export function panicSelling(
  entries: readonly LedgerEntry[],
  perStep: readonly PortfolioState[],
  options: BehaviourOptions = {},
): PanicSelling {
  const drawdownThreshold =
    options.drawdownThresholdBps ?? DEFAULTS.drawdownThresholdBps;
  const minimumSale = options.minimumSaleBps ?? DEFAULTS.minimumSaleBps;

  const soldByStep = new Map<number, Paise>();
  for (const fill of fills(entries)) {
    if (fill.side !== "sell" || fill.step === 0) continue;
    soldByStep.set(
      fill.step,
      (soldByStep.get(fill.step) ?? 0n) + fill.grossPaise,
    );
  }

  const episodes: {
    step: number;
    drawdownBps: number;
    soldValuePaise: Paise;
  }[] = [];
  let peak = 0n;
  for (const state of perStep) {
    if (state.totalValuePaise > peak) peak = state.totalValuePaise;
    const sold = soldByStep.get(state.step) ?? 0n;
    if (sold <= 0n || peak <= 0n) continue;

    const drawdownBps = Number(
      ((peak - state.totalValuePaise) * 10_000n) / peak,
    );
    const saleBps =
      state.totalValuePaise > 0n
        ? Number((sold * 10_000n) / state.totalValuePaise)
        : 0;
    if (drawdownBps >= drawdownThreshold && saleBps >= minimumSale) {
      episodes.push({ step: state.step, drawdownBps, soldValuePaise: sold });
    }
  }

  return {
    episodes,
    drawdownThresholdBps: drawdownThreshold,
    minimumSaleBps: minimumSale,
  };
}

/** How much of the book sat in its single largest holding, over time. */
export function concentration(
  perStep: readonly PortfolioState[],
): Concentration {
  let sumOfMax = 0;
  let counted = 0;
  let peakBps = 0;
  let peakStep = 0;
  let peakSymbol: Symbol_ | null = null;

  for (const state of perStep) {
    if (state.totalValuePaise <= 0n) continue;
    let stepMaxBps = 0;
    let stepSymbol: Symbol_ | null = null;
    for (const position of state.positions) {
      const weight = Number(
        (position.valuePaise * 10_000n) / state.totalValuePaise,
      );
      if (weight > stepMaxBps) {
        stepMaxBps = weight;
        stepSymbol = position.symbol;
      }
    }
    sumOfMax += stepMaxBps;
    counted += 1;
    if (stepMaxBps > peakBps) {
      peakBps = stepMaxBps;
      peakStep = state.step;
      peakSymbol = stepSymbol;
    }
  }

  return {
    timeWeightedMaxBps: counted > 0 ? Math.round(sumOfMax / counted) : 0,
    peakBps,
    peakStep,
    peakSymbol,
  };
}

export function behaviourMetrics(
  entries: readonly LedgerEntry[],
  perStep: readonly PortfolioState[],
  options: BehaviourOptions = {},
): BehaviourMetrics {
  return {
    overTrading: overTrading(entries, perStep, options),
    panicSelling: panicSelling(entries, perStep, options),
    concentration: concentration(perStep),
  };
}

/**
 * Did the shock get absorbed from cash, or did it force a sale?
 *
 * Recorded rather than inferred, because the contrast is the emergency-fund
 * lesson and the debrief has to be able to state it plainly.
 */
export function shockOutcome(entries: readonly LedgerEntry[]): {
  occurred: boolean;
  step: number | null;
  amountPaise: Paise;
  absorbedFromCash: boolean;
} {
  const shock = entries.find((entry) => entry.kind === "expense_shock");
  if (shock === undefined || shock.kind !== "expense_shock") {
    return {
      occurred: false,
      step: null,
      amountPaise: 0n,
      absorbedFromCash: false,
    };
  }
  return {
    occurred: true,
    step: shock.step,
    amountPaise: shock.amountPaise,
    absorbedFromCash: shock.absorbedFromCash,
  };
}

/** Value of a holding, exported so callers need not reimplement the rule. */
export const positionValue = valueOf;
