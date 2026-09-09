/**
 * Runs, persisted.
 *
 * The engine decides what happens; this file decides only where it is written
 * and how it is read back. Every mutation is one transaction: the ledger
 * entries, their projection into `orders` and `fills`, and the run row all
 * land together or not at all, so a run can never be half advanced (H18).
 *
 * Nothing here computes a price, a valuation or a fill. If this file ever
 * looks like it is doing arithmetic on money, something has been put in the
 * wrong place.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db/client";
import {
  fills,
  gameInstances,
  instruments,
  orders,
  runLedgerEntries,
  runs,
  scenarios,
} from "@/db/schema";
import { parseScenarioConfig, type ScenarioConfig } from "@/engine/config";
import { deriveState } from "@/engine/ledger";
import { createPriceAccessor, monthlyStepDates } from "@/engine/prices";
import { advanceStep, applyAction, createRun } from "@/engine/run";
import { canonicalJson } from "@/engine/serialise";
import { quantityToDecimalString } from "@/engine/money";
import type {
  Action,
  LedgerEntry,
  PortfolioState,
  Rejection,
  RunState,
  Symbol_,
} from "@/engine/types";
import type { StepEvent } from "@/engine/run";
import { loadBarSource } from "./price-source";
import {
  deserialiseEntry,
  fromScalars,
  serialiseEntry,
  toScalars,
  type EngineScalars,
} from "./serialise";

export class RunError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "already_ranked"
      | "not_yours"
      | "run_finished"
      | "no_scenario",
  ) {
    super(message);
    this.name = "RunError";
  }
}

export interface LoadedRun {
  readonly runId: string;
  readonly mode: "ranked" | "practice";
  readonly state: RunState;
  readonly config: ScenarioConfig;
  readonly gameInstanceId: string;
  readonly scenarioId: string;
}

async function loadConfig(
  tx: Tx,
  gameInstanceId: string,
): Promise<{ config: ScenarioConfig; scenarioId: string }> {
  const rows = await tx
    .select({
      id: scenarios.id,
      name: scenarios.name,
      version: scenarios.version,
      seed: scenarios.seed,
      configJson: scenarios.configJson,
      universe: scenarios.universe,
      startDate: scenarios.startDate,
      endDate: scenarios.endDate,
    })
    .from(gameInstances)
    .innerJoin(scenarios, eq(scenarios.id, gameInstances.scenarioId))
    .where(eq(gameInstances.id, gameInstanceId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new RunError("no scenario for this game", "no_scenario");

  // The stored config carries the parts the engine needs; name, version, seed
  // and window come from their own columns so the two cannot disagree.
  const stored = (row.configJson ?? {}) as Record<string, unknown>;
  const config = parseScenarioConfig({
    ...stored,
    name: row.name,
    version: row.version,
    seed: row.seed,
    universe: row.universe,
    window: { start: row.startDate, end: row.endDate },
  });
  return { config, scenarioId: row.id };
}

/**
 * Reads a run and rebuilds the engine's state: the scalars from the run row,
 * the ledger from `run_ledger_entries`. Folding the stored ledger is what
 * makes a resumed run identical to one that never stopped.
 */
export async function loadRun(
  tx: Tx,
  runId: string,
  userId: string,
): Promise<LoadedRun> {
  const rows = await tx
    .select({
      id: runs.id,
      userId: runs.userId,
      gameInstanceId: runs.gameInstanceId,
      currentStep: runs.currentStep,
      state: runs.state,
      mode: runs.mode,
      engineState: runs.engineState,
    })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  const row = rows[0];
  // RLS already scopes this, so a missing row is usually somebody else's run.
  // Saying "not found" either way keeps the two indistinguishable.
  if (!row || row.userId !== userId) {
    throw new RunError("no such run", "not_found");
  }
  if (row.engineState === null) {
    throw new RunError("this run has no engine state", "not_found");
  }

  const entryRows = await tx
    .select({ entryJson: runLedgerEntries.entryJson })
    .from(runLedgerEntries)
    .where(eq(runLedgerEntries.runId, runId))
    .orderBy(asc(runLedgerEntries.seq));

  const { config, scenarioId } = await loadConfig(tx, row.gameInstanceId);
  const state = fromScalars(
    row.engineState as EngineScalars,
    entryRows.map((r) => deserialiseEntry(r.entryJson)),
  );

  return {
    runId: row.id,
    mode: row.mode,
    state,
    config,
    gameInstanceId: row.gameInstanceId,
    scenarioId,
  };
}

/** Writes new entries: the ledger, then their projection into orders and fills. */
async function persistEntries(
  tx: Tx,
  runId: string,
  entries: readonly LedgerEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  await tx.insert(runLedgerEntries).values(
    entries.map((entry) => ({
      runId,
      seq: entry.seq,
      stepIndex: entry.step,
      tradeDate: entry.date,
      kind: entry.kind,
      entryJson: serialiseEntry(entry),
    })),
  );

  const trades = entries.filter(
    (entry): entry is Extract<LedgerEntry, { kind: "order_placed" }> =>
      entry.kind === "order_placed",
  );
  if (trades.length === 0) return;

  const symbols = [...new Set(trades.map((t) => t.symbol))];
  const instrumentRows = await tx
    .select({ id: instruments.id, symbol: instruments.symbol })
    .from(instruments)
    .where(inArray(instruments.symbol, symbols));
  const idBySymbol = new Map(instrumentRows.map((r) => [r.symbol, r.id]));

  const fillFor = (orderId: string) =>
    entries.find(
      (entry): entry is Extract<LedgerEntry, { kind: "fill" }> =>
        entry.kind === "fill" && entry.orderId === orderId,
    );

  for (const placed of trades) {
    const instrumentId = idBySymbol.get(placed.symbol);
    if (instrumentId === undefined) {
      throw new RunError(`unknown instrument ${placed.symbol}`, "no_scenario");
    }
    const inserted = await tx
      .insert(orders)
      .values({
        runId,
        instrumentId,
        side: placed.side,
        quantity: quantityToDecimalString(placed.quantity),
        // Unique on (run_id, idempotency_key); the engine's key is per action,
        // so the order id keeps sibling orders of one action distinct.
        idempotencyKey: `${placed.idempotencyKey}:${placed.orderId}`,
        stepIndex: placed.step,
      })
      .returning({ id: orders.id });
    const orderRow = inserted[0];
    if (!orderRow) throw new RunError("order was not written", "not_found");

    const fill = fillFor(placed.orderId);
    if (fill === undefined) continue;
    await tx.insert(fills).values({
      orderId: orderRow.id,
      pricePaise: fill.pricePaise,
      quantity: quantityToDecimalString(fill.quantity),
      stepIndex: fill.step,
    });
  }
}

async function saveRunRow(
  tx: Tx,
  runId: string,
  state: RunState,
): Promise<void> {
  await tx
    .update(runs)
    .set({
      currentStep: state.currentStep,
      state: state.status === "completed" ? "completed" : "in_progress",
      engineState: toScalars(state),
      completedAt: state.status === "completed" ? new Date() : null,
    })
    .where(eq(runs.id, runId));
}

export interface StartOptions {
  readonly userId: string;
  readonly gameInstanceId: string;
  readonly mode: "ranked" | "practice";
}

/**
 * Starts a run. A ranked attempt is refused if the member already has one
 * against the same **scenario version**, in any game instance of it, which is
 * wider than the unique index can express and is checked here.
 */
export async function startRun(
  tx: Tx,
  options: StartOptions,
): Promise<LoadedRun> {
  const { config, scenarioId } = await loadConfig(tx, options.gameInstanceId);

  if (options.mode === "ranked") {
    const existing = await tx
      .select({ id: runs.id })
      .from(runs)
      .innerJoin(gameInstances, eq(gameInstances.id, runs.gameInstanceId))
      .where(
        and(
          eq(runs.userId, options.userId),
          eq(runs.mode, "ranked"),
          eq(gameInstances.scenarioId, scenarioId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      throw new RunError(
        "one ranked attempt per scenario version; this one is used",
        "already_ranked",
      );
    }
  }

  const source = await loadBarSource(tx, {
    symbols: config.universe,
    snapshotVersion: config.snapshotVersion,
    upToDate: config.window.end,
  });
  const stepDates = monthlyStepDates(
    source.calendar,
    config.window.start,
    config.window.end,
  );
  const state = createRun(config, stepDates);

  const inserted = await tx
    .insert(runs)
    .values({
      gameInstanceId: options.gameInstanceId,
      userId: options.userId,
      currentStep: 0,
      mode: options.mode,
      engineState: toScalars(state),
    })
    .returning({ id: runs.id });
  const row = inserted[0];
  if (!row) throw new RunError("run was not created", "not_found");

  await persistEntries(tx, row.id, state.entries);

  return {
    runId: row.id,
    mode: options.mode,
    state,
    config,
    gameInstanceId: options.gameInstanceId,
    scenarioId,
  };
}

export interface MutationResult {
  readonly state: RunState;
  readonly entries: readonly LedgerEntry[];
  readonly events?: readonly StepEvent[];
  readonly rejection?: Rejection;
  /** True when an idempotency key had already been applied (H16). */
  readonly replayed: boolean;
}

/** Applies a player action and persists whatever the engine produced. */
export async function rebalance(
  tx: Tx,
  loaded: LoadedRun,
  action: Action,
): Promise<MutationResult> {
  const alreadyApplied = loaded.state.appliedKeys[action.idempotencyKey];
  const source = await loadBarSource(tx, {
    symbols: loaded.config.universe,
    snapshotVersion: loaded.config.snapshotVersion,
    upToDate: currentDate(loaded.state),
  });
  const result = applyAction(
    loaded.state,
    loaded.config,
    action,
    createPriceAccessor(source, loaded.state),
  );
  if (result.rejection !== undefined) {
    return {
      state: loaded.state,
      entries: [],
      rejection: result.rejection,
      replayed: false,
    };
  }
  if (alreadyApplied !== undefined) {
    // The engine replayed it; nothing new to write.
    return {
      state: result.runState,
      entries: result.ledgerEntries,
      replayed: true,
    };
  }

  await persistEntries(tx, loaded.runId, result.ledgerEntries);
  await saveRunRow(tx, loaded.runId, result.runState);
  return {
    state: result.runState,
    entries: result.ledgerEntries,
    replayed: false,
  };
}

/**
 * Advances one step. The idempotency key is the step being advanced *to*, so a
 * double-submitted advance cannot produce two steps' worth of entries (H16).
 */
export async function advance(
  tx: Tx,
  loaded: LoadedRun,
  idempotencyKey: string,
): Promise<MutationResult> {
  const applied = loaded.state.appliedKeys[idempotencyKey];
  if (applied !== undefined) {
    return {
      state: loaded.state,
      entries: loaded.state.entries.filter((entry) =>
        applied.entrySeqs.includes(entry.seq),
      ),
      replayed: true,
    };
  }

  const source = await loadBarSource(tx, {
    symbols: loaded.config.universe,
    snapshotVersion: loaded.config.snapshotVersion,
    // The next step's date: this is the moment the run is allowed to see it.
    upToDate:
      loaded.state.stepDates[
        Math.min(loaded.state.currentStep + 1, loaded.state.finalStep)
      ] ?? currentDate(loaded.state),
  });

  const result = advanceStep(loaded.state, loaded.config, {
    accessorFor: (state) => createPriceAccessor(source, state),
  });
  if (result.rejection !== undefined) {
    return {
      state: loaded.state,
      entries: [],
      rejection: result.rejection,
      replayed: false,
    };
  }

  const nextState: RunState = {
    ...result.runState,
    appliedKeys: {
      ...result.runState.appliedKeys,
      [idempotencyKey]: {
        step: result.runState.currentStep,
        entrySeqs: result.ledgerEntries.map((entry) => entry.seq),
      },
    },
  };

  await persistEntries(tx, loaded.runId, result.ledgerEntries);
  await saveRunRow(tx, loaded.runId, nextState);
  return {
    state: nextState,
    entries: result.ledgerEntries,
    events: result.events,
    replayed: false,
  };
}

/** Marks a run abandoned. The ledger is append-only, so nothing is removed. */
export async function abandonRun(tx: Tx, runId: string): Promise<void> {
  await tx
    .update(runs)
    .set({ state: "abandoned", completedAt: new Date() })
    .where(eq(runs.id, runId));
}

export function currentDate(state: RunState): string {
  const date = state.stepDates[state.currentStep];
  if (date === undefined)
    throw new RunError("run has no current date", "not_found");
  return date;
}

/** Portfolio state at the run's current step, valued at that step's closes. */
export async function currentPortfolio(
  tx: Tx,
  loaded: LoadedRun,
): Promise<PortfolioState> {
  const source = await loadBarSource(tx, {
    symbols: loaded.config.universe,
    snapshotVersion: loaded.config.snapshotVersion,
    upToDate: currentDate(loaded.state),
  });
  const accessor = createPriceAccessor(source, loaded.state);
  return deriveState(
    loaded.state.entries,
    accessor.current(),
    loaded.state.currentStep,
  );
}

/** Symbols in play, with their current close. Never more than the current step. */
export async function currentQuotes(
  tx: Tx,
  loaded: LoadedRun,
): Promise<
  {
    symbol: Symbol_;
    closePaise: bigint;
    synthetic: boolean;
    asOfDate: string;
  }[]
> {
  const source = await loadBarSource(tx, {
    symbols: loaded.config.universe,
    snapshotVersion: loaded.config.snapshotVersion,
    upToDate: currentDate(loaded.state),
  });
  const prices = createPriceAccessor(source, loaded.state).current();
  return loaded.config.universe
    .filter((symbol) => prices.has(symbol))
    .map((symbol) => {
      const quote = prices.close(symbol);
      return {
        symbol,
        closePaise: quote.closePaise,
        synthetic: quote.synthetic,
        asOfDate: quote.asOfDate,
      };
    });
}

/** A stable fingerprint of a run, for tests that compare two paths to it. */
export function fingerprint(state: RunState): string {
  return canonicalJson(state);
}
