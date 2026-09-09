# Phase 3 — Simulation engine

Session date: 9 September 2026. Brief and decisions:
`docs/prompts/phase-3-simulation-engine.md`. Branch `phase-3`, cut from `main`
after `phase-2` was merged.

## What was built

- **A pure engine** in `src/engine/`: create a run, set target weights, advance
  a step, fold the ledger, value a portfolio, compute both counterfactuals and
  the behavioural metrics. It imports nothing but itself and Zod. No app code,
  no database, no React, no Next, no Node builtins, no ambient time, no
  ambient randomness.
- **The ledger as the only truth.** Cash and holdings are folded from
  append-only entries every time they are asked for. `holdings_cache` is a
  cache in the strict sense, rebuilt by `npm run engine:rebuild-cache`.
- **A step-bounded price accessor.** It is constructed against a run and
  throws for any step beyond that run's current one, and exposes no method
  that returns a series, so there is nothing to slice.
- **A seeded generator** (mulberry32, twenty lines, committed) whose whole
  state is one integer, which is what lets a run serialise mid-flight.
- **The scenario config schema** in Zod, plus the v1 config for 2019-2023 as
  data in `data/scenarios/first-replay/v1/`, with its news file beside it.
- **Three golden runs** covering the full ledger, per-step state, both
  counterfactuals and the behavioural metrics.
- **A `mode` column** on `runs` for ranked versus practice, and the migration
  for it.
- **Tests**: 85 engine, 107 unit in total, 35 database (5 new for the cache).

## Decisions, as given

Monthly steps landing on the last trading day of each month; target weights
converted to orders; fractional quantities at scale 4; idle cash earning
nothing; news cards as a versioned JSON file the engine can run without; a
`mode` column; 10 bps per side rather than per round trip; buy quantities
flooring as a stated exception to the global rounding rule; income landing in
cash; the shock not forcing a liquidation when a buffer exists; execution at
the close of the step the decision is made at. Each is written into
`docs/ENGINE_RULES.md` with the reasoning, not just the rule.

## What the goldens caught

Writing the golden files immediately exposed two bugs that every unit test had
missed, which is a good argument for having them.

1. **The all-index counterfactual never bought anything.** It sized the
   purchase to the full corpus and then found it could not afford the
   transaction cost, so it fell through and held cash for five years. The
   number looked plausible until it was checked against the index: a portfolio
   that had supposedly tracked the Nifty through 2019-2023 had returned
   exactly zero. It now sizes to what it can afford, cost included, exactly as
   the player's own orders do.
2. **"Did nothing" used the player's latest weights, not their first.** So the
   comparison was against a portfolio the player only reached by trading,
   which is the opposite of doing nothing. `RunState` now records the opening
   allocation separately and never overwrites it.

Both are the kind of error that would have shipped quietly, produced a
confident-looking debrief, and taught members something false.

## Deviations from the brief

1. **`applyAction` and `advanceStep` take the scenario config explicitly**
   rather than reading it off the run state. A config is pinned by
   `(name, version)` and shared by every run of that scenario; copying it into
   each run would duplicate it and invite the two to drift.
2. **The final step is a valuation step**, and arriving at it completes the
   run. There is no further month to hold through, so no action is accepted
   there. The brief did not say either way.
3. **`createRun` takes the step dates**, computed by `monthlyStepDates` from
   the snapshot calendar, rather than a calendar it would have to interpret.
   Resolving a cadence against a calendar is not the engine's job.
4. **Snapshot reading lives in `src/lib/snapshot-bars.ts`**, not in the engine
   or its test fixtures. Reading a file is app work; the engine is handed a
   `BarSource` and cannot tell whether it came from a CSV or from Postgres,
   which is the point.

## Acceptance criteria

| #   | Criterion                                                  | Status                                                                                                                           |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Goldens pass, and fail correctly when engine logic changes | Done. Verified by changing the transaction cost by one basis point: all three failed, then reverted.                             |
| 2   | Determinism: same seed and inputs, byte-identical output   | Done, `src/engine/run.test.ts`.                                                                                                  |
| 3   | Derived state rebuilt from the ledger alone                | Done, in the engine and against the database.                                                                                    |
| 4   | Duplicate idempotency keys do not double-execute           | Done, the double-click case directly.                                                                                            |
| 5   | The engine imports nothing from app, DB, React or Next     | Done, `src/engine/architecture.test.ts`, five checks.                                                                            |
| 6   | `ENGINE_RULES.md` states every rule the brief lists        | Done: price rule, rounding and its exception, decimal scale, missing bars, costs, step landing day, and each behavioural metric. |
| 7   | `docs/phases/phase-3.md`                                   | This file.                                                                                                                       |

## Deferred

- **No UI, no routes, no API handlers**, per the brief. Phase 4 wires the
  engine to HTTP and Postgres.
- **No news cards written.** The file exists and is empty; the engine treats a
  step without a card as normal. Sixty cards for 2019-2023 is a content task
  that needs an owner and faculty review, and the hindsight rule for writing
  them is in `data/scenarios/README.md`.
- **Fixed deposits are absent from the v1 scenario**, as decided, until the
  RBI series is verified. The engine supports the asset class; nothing plays
  it.
- **Run persistence** (H18 proper) is Phase 4. The engine's half is done: a
  run serialises losslessly and a resumed run produces the same output as an
  uninterrupted one.

## Open questions for Phase 4

1. **News cards.** Who writes the sixty, and by when? Faculty review is
   required before they are club-visible, and the hindsight rule needs someone
   applying it.
2. **Which figures the debrief shows.** The engine computes more than a screen
   should display at once. The design preview's debrief page is a starting
   point but predates these metrics.
3. **Practice runs.** The `mode` column exists; Phase 4 has to enforce one
   ranked attempt per scenario version, and decide what a member sees if they
   start a ranked run and abandon it.
4. **Ownership** of GitHub, Vercel, Supabase and the domain: still unrecorded,
   carried from Phase 0.
