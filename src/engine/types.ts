/**
 * The engine's vocabulary.
 *
 * Nothing here knows about HTTP, React, Drizzle or Postgres. Prices arrive
 * through an injected accessor, time arrives as an argument, and randomness
 * arrives as seeded state. See docs/ENGINE_RULES.md for the rules these types
 * encode.
 */
import type { Paise, Quantity } from "./money";

export type Symbol_ = string;

/** An ISO date, `YYYY-MM-DD`, always a trading day from the snapshot calendar. */
export type IsoDate = string;

/**
 * One price, plus how it was arrived at.
 *
 * `synthetic` is true when the instrument had no bar on the step's date and
 * the previous close was carried forward; `asOfDate` is then the date that
 * close actually came from. A run that touches a synthetic bar stays auditable
 * rather than merely plausible (docs/ENGINE_RULES.md).
 */
export interface Quote {
  readonly symbol: Symbol_;
  readonly date: IsoDate;
  readonly closePaise: Paise;
  readonly synthetic: boolean;
  readonly asOfDate: IsoDate;
}

/**
 * Prices for exactly one step. Obtained from a step-bounded accessor, so
 * holding one of these cannot reveal anything about a later step (H15).
 */
export interface StepPrices {
  readonly step: number;
  readonly date: IsoDate;
  close(symbol: Symbol_): Quote;
  has(symbol: Symbol_): boolean;
}

/**
 * The step-bounded price accessor (H15).
 *
 * It is constructed against a run and refuses any step beyond that run's
 * current one. The bound is the accessor's whole reason to exist: the client
 * never receives future data because the server never reads it either.
 */
export interface PriceAccessor {
  readonly maxStep: number;
  at(step: number): StepPrices;
  current(): StepPrices;
}

/** Where bars come from. Phase 4 supplies one backed by `price_bars`. */
export interface BarSource {
  /** Trading days, ascending, from the snapshot calendar. */
  readonly calendar: readonly IsoDate[];
  /** Closing price on an exact date, or undefined if the instrument had no bar. */
  closeOn(symbol: Symbol_, date: IsoDate): Paise | undefined;
  /** The most recent close on or before `date`, for the carry-forward rule. */
  lastCloseOnOrBefore(
    symbol: Symbol_,
    date: IsoDate,
  ): { closePaise: Paise; date: IsoDate } | undefined;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type Side = "buy" | "sell";

/**
 * The ledger is the truth (H13). Portfolio state is folded from these entries,
 * never held as a mutable balance that something updates.
 *
 * Every entry carries `seq`, a monotonic index within the run, so a fold is
 * order-independent of how the entries were stored.
 */
export type LedgerEntry =
  | {
      readonly kind: "corpus_initialised";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly amountPaise: Paise;
    }
  | {
      readonly kind: "order_placed";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly orderId: string;
      readonly idempotencyKey: string;
      readonly symbol: Symbol_;
      readonly side: Side;
      readonly quantity: Quantity;
    }
  | {
      readonly kind: "fill";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly orderId: string;
      readonly symbol: Symbol_;
      readonly side: Side;
      readonly quantity: Quantity;
      readonly pricePaise: Paise;
      /** Quantity times price, before costs. */
      readonly grossPaise: Paise;
      /** Transaction cost, always a debit to cash. */
      readonly costPaise: Paise;
      /** True when the fill priced off a carried-forward close. */
      readonly synthetic: boolean;
    }
  | {
      readonly kind: "income";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly amountPaise: Paise;
      readonly label: string;
    }
  | {
      readonly kind: "expense";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly amountPaise: Paise;
      readonly label: string;
    }
  | {
      readonly kind: "expense_shock";
      readonly seq: number;
      readonly step: number;
      readonly date: IsoDate;
      readonly amountPaise: Paise;
      readonly label: string;
      /**
       * True when cash on hand covered it and nothing had to be sold. The
       * emergency-fund lesson is this contrast, so it is recorded, not derived.
       */
      readonly absorbedFromCash: boolean;
    };

export type LedgerEntryKind = LedgerEntry["kind"];

/** A holding and what it is worth at a given step. */
export interface Position {
  readonly symbol: Symbol_;
  readonly quantity: Quantity;
  readonly closePaise: Paise;
  readonly valuePaise: Paise;
  readonly synthetic: boolean;
}

/** Portfolio state at one step, folded from the ledger. */
export interface PortfolioState {
  readonly step: number;
  readonly date: IsoDate;
  readonly cashPaise: Paise;
  readonly positions: readonly Position[];
  readonly holdingsValuePaise: Paise;
  readonly totalValuePaise: Paise;
  /** True when any position in this valuation used a carried-forward close. */
  readonly usedSyntheticPrices: boolean;
}

// ---------------------------------------------------------------------------
// Actions and rejections
// ---------------------------------------------------------------------------

/**
 * The player sets target weights; the engine turns them into orders.
 * Weights are integer basis points and must total exactly 10000, so no
 * floating point enters the decision.
 */
export interface SetTargetWeights {
  readonly type: "set_target_weights";
  readonly idempotencyKey: string;
  readonly weightsBps: Readonly<Record<Symbol_, number>>;
}

export type Action = SetTargetWeights;

export type RejectionCode =
  | "run_not_in_progress"
  | "unknown_instrument"
  | "instrument_not_in_universe"
  | "weights_do_not_total_10000"
  | "negative_weight"
  | "no_price_for_instrument"
  | "insufficient_cash"
  | "step_out_of_range";

/**
 * An invalid action is a value, not an exception (H34). The caller has to
 * decide what to show; nothing is swallowed.
 */
export interface Rejection {
  readonly code: RejectionCode;
  readonly message: string;
  readonly detail?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type RunStatus = "in_progress" | "completed";

/**
 * Everything needed to resume a run. Serialises to JSON losslessly, including
 * the generator's state, so a closed laptop loses nothing (H18, Phase 4).
 */
export interface RunState {
  readonly scenarioName: string;
  readonly scenarioVersion: number;
  readonly seed: string;
  readonly status: RunStatus;
  readonly currentStep: number;
  readonly finalStep: number;
  readonly stepDates: readonly IsoDate[];
  readonly prng: import("./prng").PrngState;
  readonly entries: readonly LedgerEntry[];
  /** Idempotency keys already applied, and what they produced (H16). */
  readonly appliedKeys: Readonly<Record<string, AppliedAction>>;
  /** Step at which the expense shock falls, drawn from the seed at creation. */
  readonly shockStep: number;
  readonly shockAmountPaise: Paise;
  /**
   * The weights the player opened with, set once and never overwritten. The
   * "did nothing" counterfactual is *this*, held to the end; using the latest
   * weights instead would compare the player against a portfolio they only
   * arrived at by trading, which is the opposite of doing nothing.
   */
  readonly initialWeightsBps: Readonly<Record<Symbol_, number>> | null;
  /** The most recent target weights, for showing the player where they stand. */
  readonly targetWeightsBps: Readonly<Record<Symbol_, number>> | null;
  readonly nextSeq: number;
  readonly nextOrderId: number;
}

/** What a previously seen idempotency key produced, replayed verbatim. */
export interface AppliedAction {
  readonly step: number;
  readonly entrySeqs: readonly number[];
}
