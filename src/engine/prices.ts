/**
 * The step-bounded price accessor (H15).
 *
 * The client never receives future data because the server never reads it. The
 * bound is structural, not a filter applied afterwards: an accessor is built
 * against a run, and asking it for a step beyond that run's current one throws.
 * There is no method that returns a series, so there is nothing to slice.
 *
 * Missing bars carry forward (docs/ENGINE_RULES.md). Two instruments have no
 * bar on 19 and 20 December 2019 because Phase 2 removed corrupt rows, and the
 * gilt ETF simply does not trade every day. Either way the previous close is
 * used and the quote says so.
 */
import type {
  BarSource,
  IsoDate,
  PriceAccessor,
  Quote,
  RunState,
  StepPrices,
  Symbol_,
} from "./types";

export class FuturePriceError extends Error {
  constructor(step: number, maxStep: number) {
    super(
      `step ${step} is beyond the run's current step ${maxStep}: the engine ` +
        `must never read a price the player cannot yet have seen (H15)`,
    );
    this.name = "FuturePriceError";
  }
}

export class MissingPriceError extends Error {
  constructor(symbol: Symbol_, date: IsoDate) {
    super(`no price for ${symbol} on or before ${date}`);
    this.name = "MissingPriceError";
  }
}

function quoteFor(
  source: BarSource,
  symbol: Symbol_,
  date: IsoDate,
): Quote | undefined {
  const exact = source.closeOn(symbol, date);
  if (exact !== undefined) {
    return {
      symbol,
      date,
      closePaise: exact,
      synthetic: false,
      asOfDate: date,
    };
  }
  const carried = source.lastCloseOnOrBefore(symbol, date);
  if (carried === undefined) return undefined;
  return {
    symbol,
    date,
    closePaise: carried.closePaise,
    synthetic: true,
    asOfDate: carried.date,
  };
}

/**
 * Builds an accessor bound to `run.currentStep`. Advancing a run means
 * building a new accessor, which is what keeps the bound honest.
 */
export function createPriceAccessor(
  source: BarSource,
  run: Pick<RunState, "currentStep" | "stepDates">,
): PriceAccessor {
  const maxStep = run.currentStep;

  const at = (step: number): StepPrices => {
    if (!Number.isInteger(step) || step < 0) {
      throw new FuturePriceError(step, maxStep);
    }
    if (step > maxStep) throw new FuturePriceError(step, maxStep);
    const date = run.stepDates[step];
    if (date === undefined) throw new FuturePriceError(step, maxStep);
    return {
      step,
      date,
      close(symbol: Symbol_): Quote {
        const quote = quoteFor(source, symbol, date);
        if (quote === undefined) throw new MissingPriceError(symbol, date);
        return quote;
      },
      has(symbol: Symbol_): boolean {
        return quoteFor(source, symbol, date) !== undefined;
      },
    };
  };

  return { maxStep, at, current: () => at(maxStep) };
}

/**
 * An in-memory `BarSource`. Phase 4 builds one from `price_bars`; tests build
 * one from the committed snapshot or from fixtures. Bars per symbol must be
 * ascending by date.
 */
export function createBarSource(
  calendar: readonly IsoDate[],
  bars: ReadonlyMap<Symbol_, readonly { date: IsoDate; closePaise: bigint }[]>,
): BarSource {
  const byDate = new Map<Symbol_, Map<IsoDate, bigint>>();
  for (const [symbol, series] of bars) {
    byDate.set(symbol, new Map(series.map((b) => [b.date, b.closePaise])));
  }

  return {
    calendar,
    closeOn(symbol, date) {
      return byDate.get(symbol)?.get(date);
    },
    lastCloseOnOrBefore(symbol, date) {
      const series = bars.get(symbol);
      if (series === undefined || series.length === 0) return undefined;
      // Ascending by date, so the last entry not after `date` is the answer.
      let low = 0;
      let high = series.length - 1;
      let found = -1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        const candidate = series[middle];
        if (candidate === undefined) break;
        if (candidate.date <= date) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      const hit = found >= 0 ? series[found] : undefined;
      return hit === undefined
        ? undefined
        : { closePaise: hit.closePaise, date: hit.date };
    },
  };
}

/**
 * The trading days a monthly cadence lands on: the **last trading day of each
 * month** inside the window, per the snapshot's calendar
 * (docs/ENGINE_RULES.md). Taking a fixed day of the month would land on
 * holidays; taking the calendar's own last day of each month never does.
 */
export function monthlyStepDates(
  calendar: readonly IsoDate[],
  start: IsoDate,
  end: IsoDate,
): IsoDate[] {
  const lastOfMonth = new Map<string, IsoDate>();
  for (const date of calendar) {
    if (date < start || date > end) continue;
    lastOfMonth.set(date.slice(0, 7), date);
  }
  return [...lastOfMonth.values()].sort();
}
