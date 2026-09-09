/**
 * The debrief's copy, decided by rule.
 *
 * Two constraints govern every sentence produced here.
 *
 * **Deterministic and rule-based.** No model is called. The non-goals forbid
 * AI-generated investment analysis presented as club output, and feedback
 * given in the club's name has to be reproducible, and explainable to the
 * member who disagrees with it.
 *
 * **Describe, never prescribe.** "You sold 62% of your equity in March 2020
 * and rebought in August" is a description. "You should have held" is advice,
 * and the club has committed in writing to giving none. Every sentence below
 * survives that test, and any sentence added later must too
 * (docs/ENGINE_RULES.md).
 */
import { formatInIST } from "@/lib/time";
import type { BehaviourMetrics } from "@/engine/behaviour";
import type { Paise } from "@/engine/money";
import type { PortfolioState } from "@/engine/types";

export type FindingKey =
  "panic_selling" | "over_trading" | "concentration" | "nothing_stands_out";

export interface Finding {
  readonly key: FindingKey;
  /** One sentence, describing what happened. */
  readonly sentence: string;
  /** The single number that supports it. */
  readonly supporting: { readonly label: string; readonly value: string };
  /** How the metric was computed, for the disclosure section (H23). */
  readonly method: string;
}

/**
 * Where each metric stops being unremarkable. Stated here rather than buried
 * in a comparison, because a member is entitled to ask what the line was.
 */
export const BENCHMARKS = {
  /** One full turn of the portfolio over a five-year run. */
  turnoverBps: 10_000,
  /** Any episode at all is worth describing. */
  panicEpisodes: 0,
  /** Two fifths of the book in one holding. */
  concentrationPeakBps: 4_000,
} as const;

/**
 * Ties break in this order, most consequential first. Documented so the choice
 * is reproducible rather than an accident of object key order.
 */
const TIE_BREAK: readonly FindingKey[] = [
  "panic_selling",
  "over_trading",
  "concentration",
];

function rupees(paise: Paise): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = (abs / 100n).toString();
  const grouped =
    whole.length <= 3
      ? whole
      : `${whole
          .slice(0, -3)
          .replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`;
  return `${negative ? "−" : ""}₹${grouped}`;
}

function percent(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function monthOf(state: PortfolioState | undefined): string {
  if (state === undefined) return "the run";
  return formatInIST(`${state.date}T00:00:00Z`, { withTime: false });
}

/**
 * Selects the one finding to show: the metric furthest past its benchmark,
 * measured as a fraction of that benchmark so the three are comparable.
 *
 * Showing three findings at once teaches nothing; a member reads the first and
 * skims the rest. If nothing is past its line, that is said plainly rather
 * than manufacturing a finding out of the least unremarkable number.
 */
export function selectFinding(
  metrics: BehaviourMetrics,
  perStep: readonly PortfolioState[],
): Finding {
  const deviations: { key: FindingKey; deviation: number }[] = [
    {
      key: "over_trading",
      deviation:
        (metrics.overTrading.turnoverBps - BENCHMARKS.turnoverBps) /
        BENCHMARKS.turnoverBps,
    },
    {
      key: "panic_selling",
      // Each episode is one whole unit past the line.
      deviation: metrics.panicSelling.episodes.length,
    },
    {
      key: "concentration",
      deviation:
        (metrics.concentration.peakBps - BENCHMARKS.concentrationPeakBps) /
        BENCHMARKS.concentrationPeakBps,
    },
  ];

  const past = deviations.filter((d) => d.deviation > 0);
  if (past.length === 0) {
    return {
      key: "nothing_stands_out",
      sentence:
        "Nothing in your trading pattern stands out against the club's thresholds.",
      supporting: {
        label: "Trades after the opening",
        value: String(metrics.overTrading.tradeCount),
      },
      method:
        "Each of the three metrics was compared with its stated benchmark and none was past it. That is a result, not an absence of one.",
    };
  }

  past.sort((a, b) => {
    if (b.deviation !== a.deviation) return b.deviation - a.deviation;
    return TIE_BREAK.indexOf(a.key) - TIE_BREAK.indexOf(b.key);
  });
  const winner = past[0]?.key ?? "over_trading";

  if (winner === "panic_selling") {
    const worst = [...metrics.panicSelling.episodes].sort((a, b) =>
      b.soldValuePaise > a.soldValuePaise ? 1 : -1,
    )[0];
    const when = monthOf(perStep.find((s) => s.step === worst?.step));
    return {
      key: "panic_selling",
      sentence: `You sold ${rupees(worst?.soldValuePaise ?? 0n)} of holdings in ${when}, while the portfolio was ${percent(worst?.drawdownBps ?? 0)} below its own previous high.`,
      supporting: {
        label: "Steps where this happened",
        value: String(metrics.panicSelling.episodes.length),
      },
      method: `An episode is a step at which you sold at least ${percent(metrics.panicSelling.minimumSaleBps)} of portfolio value while the portfolio was at least ${percent(metrics.panicSelling.drawdownThresholdBps)} below its trailing peak. It uses only what was knowable at that step: whether the market later recovered is not part of it.`,
    };
  }

  if (winner === "concentration") {
    const { peakBps, peakSymbol, peakStep } = metrics.concentration;
    const when = monthOf(perStep.find((s) => s.step === peakStep));
    return {
      key: "concentration",
      sentence: `Your largest single holding reached ${percent(peakBps)} of the portfolio${peakSymbol ? ` in ${peakSymbol}` : ""}, in ${when}.`,
      supporting: {
        label: "Average largest holding",
        value: percent(metrics.concentration.timeWeightedMaxBps),
      },
      method:
        "The largest single holding's share of portfolio value is taken at every step, then averaged across steps and reported alongside its peak. Cash is not counted as a holding.",
    };
  }

  return {
    key: "over_trading",
    sentence: `You traded ${rupees(metrics.overTrading.turnoverPaise)} across ${metrics.overTrading.tradeCount} trades after your opening allocation, and paid ${rupees(metrics.overTrading.costPaise)} in transaction costs.`,
    supporting: {
      label: "Turnover against average portfolio value",
      value: percent(metrics.overTrading.turnoverBps),
    },
    method: `Turnover is the gross value of every trade after step 0, divided by the mean end-of-step portfolio value. The opening deployment is excluded because starting is not trading; its cost is still counted, because you paid it. A reversal is a trade whose side is opposite to the previous trade in the same instrument within ${metrics.overTrading.reversalWindowSteps} steps.`,
  };
}

/** One line on the shock: the emergency-fund lesson, stated without advice. */
export function shockSentence(
  occurred: boolean,
  absorbedFromCash: boolean,
  amountPaise: Paise,
  when: string,
  soldValuePaise: Paise,
): string {
  if (!occurred) return "No unplanned expense arose in this run.";
  if (absorbedFromCash) {
    return `An unplanned expense of ${rupees(amountPaise)} arrived in ${when}. You had the cash, so nothing was sold.`;
  }
  return `An unplanned expense of ${rupees(amountPaise)} arrived in ${when}. Cash did not cover it, so ${rupees(soldValuePaise)} of holdings were sold to meet it.`;
}

export { rupees as formatRupees, percent as formatPercent };
