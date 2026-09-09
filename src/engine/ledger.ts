/**
 * Folding the ledger into portfolio state (H13).
 *
 * The entries are the truth. There is no mutable balance anywhere in the
 * engine: cash and holdings are recomputed from the entries every time they
 * are asked for. `holdings_cache` in the database is a cache in the strict
 * sense, rebuildable from scratch by `npm run engine:rebuild-cache`.
 */
import { valueOf, type Paise, type Quantity } from "./money";
import type {
  LedgerEntry,
  PortfolioState,
  Position,
  StepPrices,
  Symbol_,
} from "./types";

/** Cash and holdings after every entry up to and including `upToStep`. */
export interface FoldedLedger {
  readonly cashPaise: Paise;
  readonly holdings: ReadonlyMap<Symbol_, Quantity>;
}

/**
 * Folds entries in sequence order. Callers may pass the whole history or a
 * prefix; the result depends only on which entries are included, never on the
 * order they were handed over, because entries are sorted by `seq` first.
 */
export function foldLedger(
  entries: readonly LedgerEntry[],
  upToStep: number,
): FoldedLedger {
  const ordered = [...entries]
    .filter((entry) => entry.step <= upToStep)
    .sort((a, b) => a.seq - b.seq);

  let cash = 0n;
  const holdings = new Map<Symbol_, Quantity>();

  for (const entry of ordered) {
    switch (entry.kind) {
      case "corpus_initialised":
      case "income":
        cash += entry.amountPaise;
        break;
      case "expense":
      case "expense_shock":
        cash -= entry.amountPaise;
        break;
      case "fill": {
        const held = holdings.get(entry.symbol) ?? 0n;
        if (entry.side === "buy") {
          holdings.set(entry.symbol, held + entry.quantity);
          cash -= entry.grossPaise + entry.costPaise;
        } else {
          holdings.set(entry.symbol, held - entry.quantity);
          cash += entry.grossPaise - entry.costPaise;
        }
        break;
      }
      case "order_placed":
        // An order is a record of intent. Only its fill moves value, so that
        // a rejected or unfilled order can never change a balance.
        break;
    }
  }

  for (const [symbol, quantity] of [...holdings]) {
    if (quantity === 0n) holdings.delete(symbol);
  }
  return { cashPaise: cash, holdings };
}

/**
 * Portfolio state at a step: the fold, valued at that step's closes.
 *
 * Valuation uses the same path for the player and for both counterfactuals, so
 * the debrief compares like with like.
 */
export function deriveState(
  entries: readonly LedgerEntry[],
  prices: StepPrices,
  upToStep: number,
): PortfolioState {
  const folded = foldLedger(entries, upToStep);
  const positions: Position[] = [];
  let holdingsValue = 0n;
  let usedSynthetic = false;

  for (const symbol of [...folded.holdings.keys()].sort()) {
    const quantity = folded.holdings.get(symbol) ?? 0n;
    const quote = prices.close(symbol);
    const value = valueOf(quantity, quote.closePaise);
    holdingsValue += value;
    if (quote.synthetic) usedSynthetic = true;
    positions.push({
      symbol,
      quantity,
      closePaise: quote.closePaise,
      valuePaise: value,
      synthetic: quote.synthetic,
    });
  }

  return {
    step: prices.step,
    date: prices.date,
    cashPaise: folded.cashPaise,
    positions,
    holdingsValuePaise: holdingsValue,
    totalValuePaise: folded.cashPaise + holdingsValue,
    usedSyntheticPrices: usedSynthetic,
  };
}
