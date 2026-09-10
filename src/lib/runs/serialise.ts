/**
 * Moving engine state in and out of Postgres.
 *
 * The engine's state splits in two on the way to the database. Its ledger goes
 * to `run_ledger_entries`, which is append-only and is the truth (H13).
 * Everything else — the generator, the drawn shock, the weights, the counters,
 * the step schedule — is the small mutable remainder and lives in
 * `runs.engine_state`.
 *
 * Both halves carry `bigint`s, which JSON cannot represent, so they are tagged
 * decimal strings. Using `number` would round silently above 2^53 and there
 * would be no way to tell afterwards.
 */
import type { LedgerEntry, RunState, Symbol_ } from "@/engine/types";
import type { PrngState } from "@/engine/prng";

const BIGINT_TAG = "__paise_bigint__:";

function tag(value: unknown): unknown {
  if (typeof value === "bigint") return `${BIGINT_TAG}${value}`;
  if (Array.isArray(value)) return value.map(tag);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        tag(v),
      ]),
    );
  }
  return value;
}

function untag(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith(BIGINT_TAG)) {
    return BigInt(value.slice(BIGINT_TAG.length));
  }
  if (Array.isArray(value)) return value.map(untag);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        untag(v),
      ]),
    );
  }
  return value;
}

/** `runs.engine_state`: everything about a run except its ledger. */
export interface EngineScalars {
  scenarioName: string;
  scenarioVersion: number;
  seed: string;
  status: RunState["status"];
  currentStep: number;
  finalStep: number;
  stepDates: string[];
  prng: PrngState;
  appliedKeys: RunState["appliedKeys"];
  shockStep: number;
  /** Tagged bigint. */
  shockAmountPaise: string;
  initialWeightsBps: Record<Symbol_, number> | null;
  targetWeightsBps: Record<Symbol_, number> | null;
  nextSeq: number;
  nextOrderId: number;
}

export function toScalars(state: RunState): EngineScalars {
  return {
    scenarioName: state.scenarioName,
    scenarioVersion: state.scenarioVersion,
    seed: state.seed,
    status: state.status,
    currentStep: state.currentStep,
    finalStep: state.finalStep,
    stepDates: [...state.stepDates],
    prng: state.prng,
    appliedKeys: state.appliedKeys,
    shockStep: state.shockStep,
    shockAmountPaise: `${BIGINT_TAG}${state.shockAmountPaise}`,
    initialWeightsBps: state.initialWeightsBps
      ? { ...state.initialWeightsBps }
      : null,
    targetWeightsBps: state.targetWeightsBps
      ? { ...state.targetWeightsBps }
      : null,
    nextSeq: state.nextSeq,
    nextOrderId: state.nextOrderId,
  };
}

/** Rebuilds the engine's state from the row and the stored ledger. */
export function fromScalars(
  scalars: EngineScalars,
  entries: readonly LedgerEntry[],
): RunState {
  return {
    scenarioName: scalars.scenarioName,
    scenarioVersion: scalars.scenarioVersion,
    seed: scalars.seed,
    status: scalars.status,
    currentStep: scalars.currentStep,
    finalStep: scalars.finalStep,
    stepDates: scalars.stepDates,
    prng: scalars.prng,
    entries: [...entries].sort((a, b) => a.seq - b.seq),
    appliedKeys: scalars.appliedKeys,
    shockStep: scalars.shockStep,
    shockAmountPaise: BigInt(
      String(scalars.shockAmountPaise).replace(BIGINT_TAG, ""),
    ),
    initialWeightsBps: scalars.initialWeightsBps,
    targetWeightsBps: scalars.targetWeightsBps,
    nextSeq: scalars.nextSeq,
    nextOrderId: scalars.nextOrderId,
  };
}

export function serialiseEntry(entry: LedgerEntry): unknown {
  return tag(entry);
}

export function deserialiseEntry(stored: unknown): LedgerEntry {
  return untag(stored) as LedgerEntry;
}
