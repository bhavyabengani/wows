/**
 * Creating a run, applying an action, advancing a step.
 *
 * Every function here is pure: inputs are never mutated, "now" is never read,
 * and randomness comes only from the run's own generator state. Two calls with
 * the same arguments produce the same result, byte for byte (H14).
 *
 * The public shape differs from the brief's sketch in one way: `applyAction`
 * and `advanceStep` take the scenario config as an explicit argument rather
 * than reading it off the run. A config is pinned by `(name, version)` and
 * shared by every run of that scenario, so copying it into each run's state
 * would duplicate it and invite the two to drift.
 */
import {
  affordableQuantity,
  divFloor,
  feeOn,
  valueOf,
  type Paise,
  type Quantity,
} from "./money";
import { nextBigIntInclusive, nextIntInclusive, seedFromText } from "./prng";
import { deriveState, foldLedger } from "./ledger";
import { newsForStep, type NewsCard, type ScenarioConfig } from "./config";
import type {
  Action,
  IsoDate,
  LedgerEntry,
  PriceAccessor,
  Rejection,
  RunState,
  Side,
  StepPrices,
  Symbol_,
} from "./types";

/** Cash is a position the player can target, but it is never a traded instrument. */
export const CASH_SYMBOL = "CASH";

export interface ActionResult {
  readonly runState: RunState;
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly rejection?: Rejection;
}

export interface StepResult {
  readonly runState: RunState;
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly events: readonly StepEvent[];
  readonly rejection?: Rejection;
}

export type StepEvent =
  | { readonly kind: "news"; readonly card: NewsCard }
  | { readonly kind: "income"; readonly amountPaise: Paise }
  | { readonly kind: "expense"; readonly amountPaise: Paise }
  | {
      readonly kind: "expense_shock";
      readonly amountPaise: Paise;
      readonly absorbedFromCash: boolean;
    }
  | { readonly kind: "run_completed" };

function reject(
  run: RunState,
  code: Rejection["code"],
  message: string,
  detail?: Record<string, string>,
): ActionResult {
  return {
    runState: run,
    ledgerEntries: [],
    rejection: detail ? { code, message, detail } : { code, message },
  };
}

// ---------------------------------------------------------------------------
// Creating a run
// ---------------------------------------------------------------------------

/**
 * Starts a run at step 0 with the corpus in cash.
 *
 * The expense shock's size and timing are drawn here, once, from the seed, so
 * two players on the same scenario meet the same shock and a replay of either
 * meets it again. It lands inside the middle `windowFraction` of the run: early
 * enough that the player has deployed, late enough that they can still react.
 */
export function createRun(
  config: ScenarioConfig,
  stepDates: readonly IsoDate[],
): RunState {
  if (stepDates.length < 2) {
    throw new Error(
      "a scenario needs at least two step dates; one step is not a replay",
    );
  }
  for (let i = 1; i < stepDates.length; i += 1) {
    const previous = stepDates[i - 1];
    const current = stepDates[i];
    if (
      previous === undefined ||
      current === undefined ||
      current <= previous
    ) {
      throw new Error("step dates must be strictly ascending");
    }
  }
  const finalStep = stepDates.length - 1;

  const margin = (1 - config.shock.windowFraction) / 2;
  const earliest = Math.max(1, Math.floor(finalStep * margin));
  const latest = Math.max(earliest, Math.floor(finalStep * (1 - margin)));

  const seeded = seedFromText(config.seed);
  const drawnStep = nextIntInclusive(seeded, earliest, latest);
  const drawnAmount = nextBigIntInclusive(
    drawnStep.state,
    config.shock.min,
    config.shock.max,
  );

  const firstDate = stepDates[0];
  if (firstDate === undefined) throw new Error("missing first step date");

  const entries: LedgerEntry[] = [
    {
      kind: "corpus_initialised",
      seq: 0,
      step: 0,
      date: firstDate,
      amountPaise: config.startingCorpus,
    },
  ];

  return {
    scenarioName: config.name,
    scenarioVersion: config.version,
    seed: config.seed,
    status: "in_progress",
    currentStep: 0,
    finalStep,
    stepDates: [...stepDates],
    prng: drawnAmount.state,
    entries,
    appliedKeys: {},
    shockStep: drawnStep.value,
    shockAmountPaise: drawnAmount.value,
    initialWeightsBps: null,
    targetWeightsBps: null,
    nextSeq: 1,
    nextOrderId: 1,
  };
}

// ---------------------------------------------------------------------------
// Rebalancing
// ---------------------------------------------------------------------------

interface Trade {
  readonly symbol: Symbol_;
  readonly side: Side;
  readonly quantity: Quantity;
  readonly pricePaise: Paise;
  readonly grossPaise: Paise;
  readonly costPaise: Paise;
  readonly synthetic: boolean;
}

/** Quantity whose value is at most `target`, floored to scale 4. */
function quantityWorth(target: Paise, price: Paise): Quantity {
  if (price <= 0n) return 0n;
  return divFloor(target * 10_000n, price);
}

/**
 * Turns target weights into trades.
 *
 * Sells run first so their proceeds are available to the buys, which is both
 * realistic and the only way a full rebalance can complete in one step. Buys
 * are taken in sorted symbol order and floored, so a run is reproducible and
 * cash can never be overdrawn (docs/ENGINE_RULES.md).
 */
function planTrades(
  config: ScenarioConfig,
  prices: StepPrices,
  weightsBps: Readonly<Record<Symbol_, number>>,
  cashPaise: Paise,
  holdings: ReadonlyMap<Symbol_, Quantity>,
  totalValuePaise: Paise,
): Trade[] {
  const bps = BigInt(config.transactionCostBps);
  const trades: Trade[] = [];
  let cash = cashPaise;

  const symbols = [...config.universe].sort();

  const targetValue = (symbol: Symbol_): Paise => {
    const weight = weightsBps[symbol] ?? 0;
    return (totalValuePaise * BigInt(weight)) / 10_000n;
  };

  // --- sells first -----------------------------------------------------
  for (const symbol of symbols) {
    const held = holdings.get(symbol) ?? 0n;
    if (held <= 0n) continue;
    const quote = prices.close(symbol);
    const currentValue = valueOf(held, quote.closePaise);
    const excess = currentValue - targetValue(symbol);
    if (excess <= 0n) continue;

    let quantity = quantityWorth(excess, quote.closePaise);
    if (quantity > held) quantity = held;
    if (quantity <= 0n) continue;

    const gross = valueOf(quantity, quote.closePaise);
    const cost = feeOn(gross, bps);
    cash += gross - cost;
    trades.push({
      symbol,
      side: "sell",
      quantity,
      pricePaise: quote.closePaise,
      grossPaise: gross,
      costPaise: cost,
      synthetic: quote.synthetic,
    });
  }

  // --- then buys, within the cash that exists --------------------------
  for (const symbol of symbols) {
    const held = holdings.get(symbol) ?? 0n;
    const quote = prices.close(symbol);
    const currentValue = valueOf(held, quote.closePaise);
    const shortfall = targetValue(symbol) - currentValue;
    if (shortfall <= 0n) continue;

    const wanted = quantityWorth(shortfall, quote.closePaise);
    const affordable = affordableQuantity(cash, quote.closePaise, bps);
    const quantity = wanted < affordable ? wanted : affordable;
    if (quantity <= 0n) continue;

    const gross = valueOf(quantity, quote.closePaise);
    const cost = feeOn(gross, bps);
    cash -= gross + cost;
    trades.push({
      symbol,
      side: "buy",
      quantity,
      pricePaise: quote.closePaise,
      grossPaise: gross,
      costPaise: cost,
      synthetic: quote.synthetic,
    });
  }

  return trades;
}

function tradeEntries(
  run: RunState,
  trades: readonly Trade[],
  step: number,
  date: IsoDate,
  idempotencyKey: string,
): { entries: LedgerEntry[]; nextSeq: number; nextOrderId: number } {
  const entries: LedgerEntry[] = [];
  let seq = run.nextSeq;
  let orderId = run.nextOrderId;

  for (const trade of trades) {
    const id = `o${orderId}`;
    entries.push({
      kind: "order_placed",
      seq: seq++,
      step,
      date,
      orderId: id,
      idempotencyKey,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
    });
    entries.push({
      kind: "fill",
      seq: seq++,
      step,
      date,
      orderId: id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      pricePaise: trade.pricePaise,
      grossPaise: trade.grossPaise,
      costPaise: trade.costPaise,
      synthetic: trade.synthetic,
    });
    orderId += 1;
  }
  return { entries, nextSeq: seq, nextOrderId: orderId };
}

// ---------------------------------------------------------------------------
// Applying an action
// ---------------------------------------------------------------------------

/**
 * Applies a player action at the run's current step.
 *
 * Orders execute at the close of the step the decision is made at, which is
 * not look-ahead: the player cannot see beyond the current step, and the
 * accessor cannot read beyond it either (docs/ENGINE_RULES.md).
 *
 * A repeated idempotency key returns the original result and creates nothing
 * (H16). That is the double-click case, and the database's unique constraint
 * on `(run_id, idempotency_key)` is the backstop, not the mechanism.
 */
export function applyAction(
  run: RunState,
  config: ScenarioConfig,
  action: Action,
  accessor: PriceAccessor,
): ActionResult {
  const seen = run.appliedKeys[action.idempotencyKey];
  if (seen !== undefined) {
    const replayed = run.entries.filter((entry) =>
      seen.entrySeqs.includes(entry.seq),
    );
    return { runState: run, ledgerEntries: replayed };
  }

  if (run.status !== "in_progress") {
    return reject(run, "run_not_in_progress", "this run has already finished");
  }

  const weights = action.weightsBps;
  let total = 0;
  for (const [symbol, weight] of Object.entries(weights)) {
    if (!Number.isInteger(weight) || weight < 0) {
      return reject(
        run,
        "negative_weight",
        `weight for ${symbol} must be a whole number of basis points, not below zero`,
        { symbol, weight: String(weight) },
      );
    }
    if (symbol !== CASH_SYMBOL && !config.universe.includes(symbol)) {
      return reject(
        run,
        "instrument_not_in_universe",
        `${symbol} is not in this scenario's universe`,
        { symbol },
      );
    }
    total += weight;
  }
  if (total !== 10_000) {
    return reject(
      run,
      "weights_do_not_total_10000",
      `weights must total exactly 10000 basis points, got ${total}`,
      { total: String(total) },
    );
  }

  const prices = accessor.current();
  for (const symbol of Object.keys(weights)) {
    if (symbol === CASH_SYMBOL) continue;
    if (!prices.has(symbol)) {
      return reject(
        run,
        "no_price_for_instrument",
        `no price for ${symbol} on or before ${prices.date}`,
        { symbol, date: prices.date },
      );
    }
  }

  const state = deriveState(run.entries, prices, run.currentStep);
  const folded = foldLedger(run.entries, run.currentStep);
  const trades = planTrades(
    config,
    prices,
    weights,
    state.cashPaise,
    folded.holdings,
    state.totalValuePaise,
  );

  const { entries, nextSeq, nextOrderId } = tradeEntries(
    run,
    trades,
    run.currentStep,
    prices.date,
    action.idempotencyKey,
  );

  const runState: RunState = {
    ...run,
    entries: [...run.entries, ...entries],
    appliedKeys: {
      ...run.appliedKeys,
      [action.idempotencyKey]: {
        step: run.currentStep,
        entrySeqs: entries.map((entry) => entry.seq),
      },
    },
    initialWeightsBps: run.initialWeightsBps ?? { ...weights },
    targetWeightsBps: { ...weights },
    nextSeq,
    nextOrderId,
  };
  return { runState, ledgerEntries: entries };
}

// ---------------------------------------------------------------------------
// Advancing a step
// ---------------------------------------------------------------------------

/**
 * Moves to the next step and applies that step's cash flows.
 *
 * Income lands in **cash**, never auto-invested: deciding what to do with it
 * each month is the game. The shock is absorbed from cash when cash covers it,
 * and only forces a sale when it does not. The engine records which happened,
 * because that contrast is the emergency-fund lesson.
 */
export function advanceStep(
  run: RunState,
  config: ScenarioConfig,
  source: {
    accessorFor: (run: RunState) => PriceAccessor;
  },
): StepResult {
  if (run.status !== "in_progress") {
    return {
      runState: run,
      ledgerEntries: [],
      events: [],
      rejection: {
        code: "run_not_in_progress",
        message: "this run has already finished",
      },
    };
  }
  if (run.currentStep >= run.finalStep) {
    return {
      runState: { ...run, status: "completed" },
      ledgerEntries: [],
      events: [{ kind: "run_completed" }],
    };
  }

  const step = run.currentStep + 1;
  const date = run.stepDates[step];
  if (date === undefined) {
    return {
      runState: run,
      ledgerEntries: [],
      events: [],
      rejection: {
        code: "step_out_of_range",
        message: `no date for step ${step}`,
      },
    };
  }

  const entries: LedgerEntry[] = [];
  const events: StepEvent[] = [];
  let seq = run.nextSeq;
  let orderId = run.nextOrderId;

  if (config.monthlyIncome > 0n) {
    entries.push({
      kind: "income",
      seq: seq++,
      step,
      date,
      amountPaise: config.monthlyIncome,
      label: "Monthly income",
    });
    events.push({ kind: "income", amountPaise: config.monthlyIncome });
  }
  if (config.monthlyExpense > 0n) {
    entries.push({
      kind: "expense",
      seq: seq++,
      step,
      date,
      amountPaise: config.monthlyExpense,
      label: "Monthly expenses",
    });
    events.push({ kind: "expense", amountPaise: config.monthlyExpense });
  }

  // The new step's prices are readable only once the run has moved to it.
  const advanced: RunState = {
    ...run,
    currentStep: step,
    entries: [...run.entries, ...entries],
  };
  const prices = source.accessorFor(advanced).current();

  if (step === run.shockStep && run.shockAmountPaise > 0n) {
    const before = foldLedger(advanced.entries, step);
    const absorbed = before.cashPaise >= run.shockAmountPaise;
    entries.push({
      kind: "expense_shock",
      seq: seq++,
      step,
      date,
      amountPaise: run.shockAmountPaise,
      label: config.shock.label,
      absorbedFromCash: absorbed,
    });
    events.push({
      kind: "expense_shock",
      amountPaise: run.shockAmountPaise,
      absorbedFromCash: absorbed,
    });

    if (!absorbed) {
      // Only sell what the shortfall requires, largest holding first, so the
      // forced sale is deterministic and as small as it can be.
      const shortfall = run.shockAmountPaise - before.cashPaise;
      const raised = raiseCash(
        config,
        prices,
        before.holdings,
        shortfall,
        step,
        date,
        seq,
        orderId,
      );
      entries.push(...raised.entries);
      seq = raised.nextSeq;
      orderId = raised.nextOrderId;
    }
  }

  const card = newsForStep(config, step);
  if (card !== undefined) events.push({ kind: "news", card });

  const status = step >= run.finalStep ? "completed" : "in_progress";
  if (status === "completed") events.push({ kind: "run_completed" });

  return {
    runState: {
      ...run,
      status,
      currentStep: step,
      entries: [...run.entries, ...entries],
      nextSeq: seq,
      nextOrderId: orderId,
    },
    ledgerEntries: entries,
    events,
  };
}

/** Sells, largest holding first, until `needed` paise of cash has been raised. */
function raiseCash(
  config: ScenarioConfig,
  prices: StepPrices,
  holdings: ReadonlyMap<Symbol_, Quantity>,
  needed: Paise,
  step: number,
  date: IsoDate,
  startSeq: number,
  startOrderId: number,
): { entries: LedgerEntry[]; nextSeq: number; nextOrderId: number } {
  const bps = BigInt(config.transactionCostBps);
  const entries: LedgerEntry[] = [];
  let seq = startSeq;
  let orderId = startOrderId;
  let remaining = needed;

  const byValue = [...holdings.entries()]
    .filter(([, quantity]) => quantity > 0n)
    .map(([symbol, quantity]) => {
      const quote = prices.close(symbol);
      return {
        symbol,
        quantity,
        quote,
        value: valueOf(quantity, quote.closePaise),
      };
    })
    // Largest first; symbol breaks a tie so the order never depends on a Map.
    .sort((a, b) =>
      a.value === b.value
        ? a.symbol.localeCompare(b.symbol)
        : a.value > b.value
          ? -1
          : 1,
    );

  for (const holding of byValue) {
    if (remaining <= 0n) break;
    // Gross up for the cost so the sale actually clears the shortfall.
    const grossNeeded = remaining + feeOn(remaining, bps);
    let quantity = quantityWorth(grossNeeded, holding.quote.closePaise) + 1n;
    if (quantity > holding.quantity) quantity = holding.quantity;
    if (quantity <= 0n) continue;

    const gross = valueOf(quantity, holding.quote.closePaise);
    const cost = feeOn(gross, bps);
    remaining -= gross - cost;

    const id = `o${orderId}`;
    entries.push({
      kind: "order_placed",
      seq: seq++,
      step,
      date,
      orderId: id,
      idempotencyKey: `forced-sale-step-${step}-${holding.symbol}`,
      symbol: holding.symbol,
      side: "sell",
      quantity,
    });
    entries.push({
      kind: "fill",
      seq: seq++,
      step,
      date,
      orderId: id,
      symbol: holding.symbol,
      side: "sell",
      quantity,
      pricePaise: holding.quote.closePaise,
      grossPaise: gross,
      costPaise: cost,
      synthetic: holding.quote.synthetic,
    });
    orderId += 1;
  }

  return { entries, nextSeq: seq, nextOrderId: orderId };
}
