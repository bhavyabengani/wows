/**
 * What the browser is allowed to know about a run.
 *
 * This is the H15 boundary in one place. Everything the client receives passes
 * through here, and it carries **only the current step**: no future price, no
 * future news card, no step schedule, no seed, and nothing about the shock
 * until it has happened.
 *
 * Building the payload explicitly, rather than trimming a run object, is
 * deliberate. A trimmed object grows a field back the first time somebody adds
 * one to the source type; a constructed one does not compile until a human
 * decides where the new field belongs.
 */
import { newsForStep, type ScenarioConfig } from "@/engine/config";
import type { PortfolioState, RunState, Symbol_ } from "@/engine/types";

export interface QuoteView {
  readonly symbol: Symbol_;
  readonly closePaise: string;
  /** True when this close was carried forward from an earlier day. */
  readonly synthetic: boolean;
  readonly asOfDate: string;
}

export interface PositionView {
  readonly symbol: Symbol_;
  readonly quantity: string;
  readonly valuePaise: string;
  readonly synthetic: boolean;
}

export interface RunView {
  readonly runId: string;
  readonly mode: "ranked" | "practice";
  readonly status: RunState["status"];
  readonly step: number;
  /** How many steps in total. A count, not a schedule. */
  readonly totalSteps: number;
  /** Only this step's date. The rest of the schedule stays on the server. */
  readonly date: string;
  readonly scenarioName: string;
  readonly cashPaise: string;
  readonly totalValuePaise: string;
  readonly startingCorpusPaise: string;
  readonly positions: readonly PositionView[];
  readonly quotes: readonly QuoteView[];
  readonly targetWeightsBps: Readonly<Record<Symbol_, number>> | null;
  readonly universe: readonly Symbol_[];
  readonly news: {
    readonly dateline: string;
    readonly headline: string;
    readonly body: string;
    readonly source: string;
  } | null;
  /** This step's cash flows, after they have happened. */
  readonly stepFlows: readonly {
    readonly kind: string;
    readonly label: string;
    readonly amountPaise: string;
  }[];
  readonly usedSyntheticPrices: boolean;
}

export function toRunView(input: {
  runId: string;
  mode: "ranked" | "practice";
  state: RunState;
  config: ScenarioConfig;
  portfolio: PortfolioState;
  quotes: readonly {
    symbol: Symbol_;
    closePaise: bigint;
    synthetic: boolean;
    asOfDate: string;
  }[];
}): RunView {
  const { state, config, portfolio } = input;
  const step = state.currentStep;

  // Only cards at or before the current step exist as far as the client is
  // concerned, and only this step's is sent.
  const card = newsForStep(config, step);

  const flows = state.entries
    .filter(
      (entry) =>
        entry.step === step &&
        (entry.kind === "income" ||
          entry.kind === "expense" ||
          entry.kind === "expense_shock"),
    )
    .map((entry) => ({
      kind: entry.kind,
      label:
        entry.kind === "income" ||
        entry.kind === "expense" ||
        entry.kind === "expense_shock"
          ? entry.label
          : entry.kind,
      amountPaise:
        entry.kind === "income"
          ? String(entry.amountPaise)
          : String(-("amountPaise" in entry ? entry.amountPaise : 0n)),
    }));

  return {
    runId: input.runId,
    mode: input.mode,
    status: state.status,
    step,
    totalSteps: state.finalStep + 1,
    date: state.stepDates[step] ?? "",
    scenarioName: state.scenarioName,
    cashPaise: String(portfolio.cashPaise),
    totalValuePaise: String(portfolio.totalValuePaise),
    startingCorpusPaise: String(config.startingCorpus),
    positions: portfolio.positions.map((position) => ({
      symbol: position.symbol,
      quantity: String(position.quantity),
      valuePaise: String(position.valuePaise),
      synthetic: position.synthetic,
    })),
    quotes: input.quotes.map((quote) => ({
      symbol: quote.symbol,
      closePaise: String(quote.closePaise),
      synthetic: quote.synthetic,
      asOfDate: quote.asOfDate,
    })),
    targetWeightsBps: state.targetWeightsBps,
    universe: config.universe,
    news: card
      ? {
          dateline: card.dateline,
          headline: card.headline,
          body: card.body,
          source: card.source,
        }
      : null,
    stepFlows: flows,
    usedSyntheticPrices: portfolio.usedSyntheticPrices,
  };
}
