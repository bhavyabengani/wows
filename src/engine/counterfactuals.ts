/**
 * The two comparisons the debrief is built on.
 *
 * Both are run through the **same** valuation path as the player's portfolio,
 * `deriveState` over a ledger, so the comparison is like for like. A
 * counterfactual computed by a shortcut would be a different measurement
 * wearing the same units.
 *
 * Both also receive the same cash flows the player received: the same income,
 * the same routine expenses, the same shock at the same step. Otherwise the
 * comparison would measure the cash flows rather than the decisions.
 */
import { affordableQuantity, feeOn, valueOf, type Paise } from "./money";
import { deriveState, foldLedger } from "./ledger";
import type { ScenarioConfig } from "./config";
import type {
  IsoDate,
  LedgerEntry,
  PortfolioState,
  StepPrices,
  Symbol_,
} from "./types";
import { CASH_SYMBOL } from "./run";

export interface CounterfactualResult {
  readonly key: "did_nothing" | "all_index";
  readonly label: string;
  readonly finalValuePaise: Paise;
  readonly entries: readonly LedgerEntry[];
  /** True if any valuation along the way used a carried-forward close. */
  readonly usedSyntheticPrices: boolean;
}

/** Prices for every step, supplied by the caller who owns the run's bounds. */
export type StepPriceLookup = (step: number) => StepPrices;

interface Deployment {
  readonly weightsBps: Readonly<Record<Symbol_, number>>;
}

/**
 * Builds a ledger for a portfolio that deploys once at step 0 and is then left
 * alone, receiving the player's cash flows but never trading again.
 */
function simulateHold(
  config: ScenarioConfig,
  playerEntries: readonly LedgerEntry[],
  prices: StepPriceLookup,
  finalStep: number,
  deployment: Deployment,
): { entries: LedgerEntry[]; usedSynthetic: boolean } {
  const bps = BigInt(config.transactionCostBps);
  const entries: LedgerEntry[] = [];
  let seq = 0;
  let usedSynthetic = false;

  const stepZero = prices(0);
  entries.push({
    kind: "corpus_initialised",
    seq: seq++,
    step: 0,
    date: stepZero.date,
    amountPaise: config.startingCorpus,
  });

  // Deploy once, at step 0's close, paying the same cost the player paid.
  let cash = config.startingCorpus;
  for (const symbol of [...config.universe].sort()) {
    const weight = deployment.weightsBps[symbol] ?? 0;
    if (weight <= 0) continue;
    const quote = stepZero.close(symbol);
    if (quote.synthetic) usedSynthetic = true;
    const target = (config.startingCorpus * BigInt(weight)) / 10_000n;
    // The cost has to come out of the same cash, exactly as it does for the
    // player. Sizing to the target and then discovering it is a paise short is
    // how a counterfactual silently buys nothing at a 100% weight.
    const wanted = (target * 10_000n) / quote.closePaise;
    const affordable = affordableQuantity(cash, quote.closePaise, bps);
    const quantity = wanted < affordable ? wanted : affordable;
    if (quantity <= 0n) continue;
    const gross = valueOf(quantity, quote.closePaise);
    const cost = feeOn(gross, bps);
    cash -= gross + cost;
    entries.push({
      kind: "fill",
      seq: seq++,
      step: 0,
      date: stepZero.date,
      orderId: `cf-${symbol}`,
      symbol,
      side: "buy",
      quantity,
      pricePaise: quote.closePaise,
      grossPaise: gross,
      costPaise: cost,
      synthetic: quote.synthetic,
    });
  }

  // Mirror the player's cash flows exactly, and nothing else.
  for (const entry of playerEntries) {
    if (
      entry.kind === "income" ||
      entry.kind === "expense" ||
      entry.kind === "expense_shock"
    ) {
      if (entry.step > finalStep) continue;
      entries.push({ ...entry, seq: seq++ });
    }
  }

  return { entries, usedSynthetic };
}

/** The initial allocation, held untouched to the end. */
export function didNothing(
  config: ScenarioConfig,
  playerEntries: readonly LedgerEntry[],
  prices: StepPriceLookup,
  finalStep: number,
  initialWeightsBps: Readonly<Record<Symbol_, number>> | null,
): CounterfactualResult {
  const weights = initialWeightsBps ?? { [CASH_SYMBOL]: 10_000 };
  const built = simulateHold(config, playerEntries, prices, finalStep, {
    weightsBps: weights,
  });
  const final = deriveState(built.entries, prices(finalStep), finalStep);
  return {
    key: "did_nothing",
    label: "Did nothing: the opening mix, held",
    finalValuePaise: final.totalValuePaise,
    entries: built.entries,
    usedSyntheticPrices: built.usedSynthetic || final.usedSyntheticPrices,
  };
}

/** The whole corpus in the benchmark index, never traded again. */
export function allIndex(
  config: ScenarioConfig,
  playerEntries: readonly LedgerEntry[],
  prices: StepPriceLookup,
  finalStep: number,
): CounterfactualResult {
  const built = simulateHold(config, playerEntries, prices, finalStep, {
    weightsBps: { [config.benchmarkSymbol]: 10_000 },
  });
  const final = deriveState(built.entries, prices(finalStep), finalStep);
  return {
    key: "all_index",
    label: `All ${config.benchmarkSymbol}, no trades`,
    finalValuePaise: final.totalValuePaise,
    entries: built.entries,
    usedSyntheticPrices: built.usedSynthetic || final.usedSyntheticPrices,
  };
}

export interface DebriefInputs {
  readonly finalValuePaise: Paise;
  readonly startingCorpusPaise: Paise;
  readonly counterfactuals: readonly CounterfactualResult[];
  readonly perStep: readonly PortfolioState[];
  /**
   * How to read every figure above. Carried from the snapshot rather than
   * guessed at by the interface (docs/DATA.md).
   */
  readonly priceBasis: {
    readonly basis: string;
    readonly isAdjusted: boolean;
    readonly adjustedAsOf: IsoDate;
    readonly dividendsIncluded: boolean;
    readonly usedSyntheticPrices: boolean;
  };
}

/** Everything the debrief needs, computed once, from the ledger. */
export function debriefInputs(
  config: ScenarioConfig,
  playerEntries: readonly LedgerEntry[],
  prices: StepPriceLookup,
  finalStep: number,
  initialWeightsBps: Readonly<Record<Symbol_, number>> | null,
  priceBasis: Omit<DebriefInputs["priceBasis"], "usedSyntheticPrices">,
): DebriefInputs {
  const perStep: PortfolioState[] = [];
  for (let step = 0; step <= finalStep; step += 1) {
    perStep.push(deriveState(playerEntries, prices(step), step));
  }
  const counterfactuals = [
    didNothing(config, playerEntries, prices, finalStep, initialWeightsBps),
    allIndex(config, playerEntries, prices, finalStep),
  ];
  const finalState = perStep[perStep.length - 1];
  const usedSynthetic =
    perStep.some((state) => state.usedSyntheticPrices) ||
    counterfactuals.some((cf) => cf.usedSyntheticPrices);

  return {
    finalValuePaise: finalState?.totalValuePaise ?? 0n,
    startingCorpusPaise: config.startingCorpus,
    counterfactuals,
    perStep,
    priceBasis: { ...priceBasis, usedSyntheticPrices: usedSynthetic },
  };
}

/** Total cash the run has left after the fold, for callers that want it alone. */
export function cashAt(
  entries: readonly LedgerEntry[],
  upToStep: number,
): Paise {
  return foldLedger(entries, upToStep).cashPaise;
}
