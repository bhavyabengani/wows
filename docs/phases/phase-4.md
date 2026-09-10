# Phase 4 — Allocation game

Session date: 9 September 2026. Brief and decisions:
`docs/prompts/phase-4-allocation-game.md`. Branch `phase-4`, cut from `main`
after `phase-3` was merged.

## What was built

- **`/play/allocate`**: one timestep at a time, with the replay date,
  portfolio value, cash, this month's flows, the news slot, target-weight
  inputs that show the residual rather than normalising it, and Advance.
  Loading, error and empty states are real screens in the interface's voice.
- **`/play/allocate/debrief`**: the layout as decided, leading with the gap
  against doing nothing rather than the corpus.
- **Persistence and resumption.** A new `run_ledger_entries` table holds the
  whole ledger, append-only at the database; `runs.engine_state` holds the
  small mutable remainder. Every advance is one transaction: ledger entries,
  their projection into `orders` and `fills`, and the run row.
- **Ranked versus practice**, enforced server-side across every game instance
  of a scenario version, with a partial unique index as the backstop.
- **A rate limit** counted in the database rather than in memory, because the
  app runs on instances that share none.
- **Tests**: 114 unit, 46 database (11 new for the run flow), and four
  end-to-end covering the full flow, resumption, idempotency, the ranked rule
  and the network inspection.

## The one rule that governed the phase

The engine was not changed. Not a line. Everything this phase needed already
existed behind the Phase 3 boundary, which is the outcome that boundary was
drawn for. The app layer decides only where things are written and how they
are read back; it computes no price, no valuation and no fill.

## H15, and why it is tested at the network

The requirement most easily broken by a UI phase is the one about future data,
so it has three independent defences rather than one.

1. **The engine's accessor** is built against a run and throws for any step
   beyond it, and returns no series to slice (Phase 3).
2. **The server does not read ahead.** `src/lib/runs/price-source.ts` selects
   bars only up to the run's current step date, so a future price is not in
   memory to leak.
3. **The payload is constructed, not trimmed.** `src/lib/runs/view.ts` builds
   what the browser receives field by field. A trimmed object grows a field
   back the first time somebody adds one upstream; a constructed one does not
   compile until a human decides where the new field belongs.

The test captures every response during a partial run and asserts that no date
beyond the current step appears in any of them, plus that the seed, the shock
and the step schedule appear nowhere. **The assertion is on dates, not on
field names**, so renaming a property cannot quietly switch it off.

## What was taken from `design-preview`

Layout and idiom, not code. Specifically: the ruled-section rhythm with no
cards or shadows; the signed-figure treatment pairing an arrow and a sign with
colour; display-size numbers in the mono face with the label above; the
oxblood left rule for a callout; and the debrief's shape of a lead figure over
a row of supporting numbers. Nothing was copied file for file, because the
preview was built on hardcoded data with no server, and it renders a different
set of numbers from the ones the engine actually produces.

## Deviations from the brief

1. **A `run_ledger_entries` table was added.** The brief said the app inserts
   the engine's entries into `orders` and `fills`. Those two are typed for
   trades and there is no table for income, expenses or the shock, so a ledger
   built from them alone would be missing its cash flows, and H13 says the
   ledger is the truth. Trades are still projected into `orders` and `fills`
   as the Phase 1 schema requires; a test asserts the two agree.
   **Confirmed on 10 September 2026**: the brief's data model sketch was
   explicitly not prescriptive on exact columns, and this is the case it did
   not anticipate. The projection test into `orders` and `fills` is what keeps
   the deviation honest.
2. **No TanStack Query.** It is in the decided stack, but the run screen needs
   one request at a time and no cache. The brief explicitly names a warmed
   query cache as a way to break H15, so not having one is a smaller surface,
   not a shortcut. It stays available for a phase that needs it.
3. **The rate limit is a fixed window, in a new `rate_limits` table.** A
   fixed window can allow up to twice the limit across a boundary; that is
   accepted, because this exists to stop a stuck client, not to meter an API.
4. **The seed now stores the real scenario**, read from
   `data/scenarios/first-replay/v1/`, and opens the game. Phase 1's
   placeholder config could not be parsed by the engine.

## Practice-run rules: confirmed 10 September 2026

Open question 3 was not answered before the phase shipped, so the brief's own
recommendation was implemented. It has since been confirmed as built.

- A ranked run cannot be restarted; a second one is refused with a 409 that
  points at practice.
- Practice runs are unlimited and labelled as unranked throughout the run and
  on the debrief.
- `runs.state` has an `abandoned` value and `abandonRun` marks it. Nothing is
  deleted, because the ledger is append-only.
- **Abandoning a ranked run consumes the attempt.** The check counts ranked
  runs regardless of state, and that is deliberate. Releasing the attempt
  would let a member start a ranked run, see March 2020 coming, abandon, and
  restart knowing what is ahead: an information leak dressed as a fairness
  feature, defeating H15 at the human layer rather than the network layer.
  The cost is a member who loses a run to a genuine accident, and that is to
  be handled as an admin action with an audit entry (Phase 9), not as a rule.

## Acceptance criteria

| #   | Criterion                                                               | Status                                                       |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | A full 60-step run completes and reaches the debrief                    | Done, end to end.                                            |
| 2   | The run survives a browser close and resumes at the right step          | Done, end to end, and proved byte-identical at the database. |
| 3   | No future prices, news or seed reach the client, asserted automatically | Done, network inspection.                                    |
| 4   | A second ranked attempt is refused server-side                          | Done, at the database and end to end.                        |
| 5   | All tests pass in CI                                                    | See the run linked from the final commit.                    |
| 6   | `docs/phases/phase-4.md`, including what was taken from the preview     | This file.                                                   |

## Deferred

- **News cards**: none written, as decided. The slot renders nothing at all
  when a step has no card, and adding cards later needs no code change. The
  `written_from` validation the decisions ask for is **not yet built**: the
  current schema has `step`, `dateline`, `headline`, `body` and `source`, and
  the decided format uses `step_date`, `source_url` and `written_from`.
  Reconciling the two is a small change and belongs with the first real card.
- **Order preview before committing.** The brief asks to show the resulting
  trades and their cost before the player commits. The residual and the cost
  rule are on screen, but a server-computed preview of the exact trades is
  not; the rebalance itself is server-computed and reversible only by trading
  again. This is the clearest gap in the phase.
- **A leaderboard**, per the decisions: Phase 6.

## Still outstanding after Phase 5 began

1. **The order preview.** The brief asked to show the resulting trades and
   their cost before the player commits. Not built; the clearest gap in the
   phase, and still unscheduled.
2. **The news-card format**: reconcile the engine's schema (`step`,
   `dateline`, `headline`, `body`, `source`) with the decided one
   (`step_date`, `source_url`, `written_from`), and add the
   `written_from <= step_date` check that makes the hindsight rule mechanical.
   Belongs with the first real card.
3. **Ownership** is recorded rather than unknown, but the migration to a
   club-owned account is still pending and still nobody's dated task.

## Settled since

- **Abandonment and the ranked attempt**: settled above, 10 September 2026.
- **The `run_ledger_entries` deviation**: endorsed, 10 September 2026.

## What a real run surfaced

Playing the game rather than testing it found three things no test could
have: a zero that read as a bug (a run with no trades after the opening has no
gap to report, so the debrief now says so in words rather than showing
`₹0.00`), dates that read as data, and loading copy inherited from the wrong
screen. The standing instruction from this is to get four or five members to
play a full run and write down what confused them, before Phase 6 hardens
anything on top.
