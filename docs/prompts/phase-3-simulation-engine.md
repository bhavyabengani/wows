# WOWS Portal — Phase 3: Simulation engine (no UI)

This session is **Phase 3 of 12**. Phases 0–2 are merged and green: repo and CI, schema with RLS and auth, and snapshot `v1` (23 instruments, 102,152 bars, 2007–2026) loadable by `npm run db:load-snapshot -- v1`. Do not do anything from Phase 4 onward — **no UI, no React, no routes, no API handlers**. Read this prompt, then `CLAUDE.md`, `docs/ENGINE_RULES.md`, `docs/DATA.md`, and `docs/phases/phase-2.md` before touching the filesystem. Where this prompt and the merged code disagree, the code wins; note the difference in your summary.

## Working agreement (applies to every session)

- One phase per session. Read before writing. Small, reviewable commits.
- If a requirement is unclear or conflicts with the code, **stop and ask**. The open questions at the end are extensive and most of them block; raise them all before writing engine logic, because the ledger shape depends on the answers.
- No features beyond the brief. Every `[HARD]` requirement traceable to a test; update the "Tested by:" lines in `CLAUDE.md`.
- Every new dependency justified in `docs/DEPENDENCIES.md`. This phase should need approximately none — a decimal library at most.
- End with `docs/phases/phase-3.md`: built, deferred, deviations.

## What this phase is

> _"The engine is a pure, deterministic, server-side module. It has no knowledge of HTTP, React, or the database schema beyond what it is passed."_

That sentence is the whole design constraint. The engine is a library: it takes a scenario config, a seed, a price accessor, and a sequence of actions, and it returns ledger entries and derived state. It does not import Drizzle. It does not read `process.env`. It does not know what a request is. Phase 4 wires it to HTTP and Postgres; if Phase 4 turns out to need engine changes to do that, the engine boundary was drawn wrong.

**This is the most reliability-critical code in the project.** A wrong valuation or a silently dropped order costs the club its credibility. Prefer obvious code over clever code throughout.

## Carried-over decisions from Phase 2 (already settled — do not reopen)

- Prices in the snapshot are **adjusted to the fetch date**, not the replay window. `is_adjusted` and `adjusted_as_of` are carried on the snapshot record. The engine passes these through to whatever it returns for display; it does not attempt to un-adjust. Returns are correct; absolute levels do not match a historical newspaper.
- **Restriction, not adjustment**: the v1 universe has no splits or bonuses inside the 2019–2023 window.
- **FD is excluded from the v1 scenario universe** until the RBI series is verified in a later snapshot. Build the engine so a fixed-deposit instrument _can_ exist, but do not put one in the first scenario config.
- Rounding follows `docs/ENGINE_RULES.md` (half away from zero), not the brief's parenthetical.
- Money is integer paise everywhere. Quantities use a fixed-precision decimal with the scale stated in `ENGINE_RULES.md`.

## Deliverables

### 1. The pure engine module

Place it somewhere with no path back into app code (e.g. `src/engine/`), and add a lint rule or an architecture test that **fails if the engine imports from the app, the database layer, React, or Next.js**. That test is the boundary's only real defence.

Shape the public surface roughly as:

- `createRun(scenarioConfig, seed) → RunState`
- `applyAction(runState, action, priceAccessor) → { runState, ledgerEntries, rejection? }`
- `advanceStep(runState, priceAccessor) → { runState, ledgerEntries, events }`
- `deriveState(ledgerEntries, priceAccessor, upToStep) → PortfolioState`

Names are yours; the properties that matter:

- **Pure functions.** No mutation of inputs, no ambient time, no ambient randomness. Every function that needs "now" takes a timestamp; every function that needs randomness takes a seeded generator.
- **The price accessor is injected and step-bounded.** `[HARD] H15`: the accessor's signature must make it _impossible_ to request a bar beyond the run's current step — it takes the run state and returns prices only up to `current_step`. Do not implement this as a filter applied later. A test must assert that requesting a future date throws rather than returns.
- **Rejections are values, not exceptions.** An invalid action (insufficient cash, unknown instrument, closed run) returns a structured rejection the caller can surface. `[HARD] H34`: nothing is silently ignored.

### 2. The ledger

`[HARD] H13`: append-only entries are the truth; portfolio state is **derived by folding them**, never a mutable balance that gets updated.

- Every state-changing occurrence is a ledger entry: order placed, fill, income received, expense paid, expense shock, dividend or coupon if modelled, FD interest if modelled, corpus initialised.
- `deriveState` folds entries in order and returns cash, holdings, and valuation at a given step. It must produce the same result whether called on the full history or incrementally.
- `holdings_cache` is a cache and nothing more. Provide `npm run engine:rebuild-cache` that truncates and refolds from the ledger, plus a test that mutates the cache to a wrong value, rebuilds, and asserts the correct value returns.
- Valuation uses the documented price rule. **Write the rule in `docs/ENGINE_RULES.md`** — the brief requires it to be explicit, not implicit in code. Default: trades execute at the close of the next available trading day after submission. State what "next available" means when the next day has no bar (see open question 1).

### 3. Determinism and idempotency

- `[HARD] H14`: all randomness derives from the seed stored on the game instance. Use an explicit seeded PRNG committed in-repo (a small, well-known algorithm — do not use `Math.random`, and do not add a dependency if a 20-line implementation suffices). Same seed plus same inputs produces byte-identical output; a test asserts this by running a full scenario twice and comparing serialised output.
- `[HARD] H16`: every order carries a client-generated idempotency key. Submitting a duplicate key returns the _original_ result and creates no second order. Test the double-click case directly. Note that the DB unique constraint on `(run_id, idempotency_key)` from Phase 1 is the backstop — the engine must also handle it as a value, since the engine has no database.

### 4. Allocation-game mechanics

From the brief, for `/play/allocate`:

- A scenario replays a fixed multi-year window compressed into a 15–25 minute session.
- Starting corpus allocated across asset classes: large-cap index, mid/small-cap index, individual equities from the curated universe, government bonds, gold, fixed deposit, cash. (FD absent from v1 per above.)
- Time advances in steps; the player may rebalance at each step.
- Periodic income arrives; periodic expenses occur; **at least one unplanned expense shock** occurs. This is the emergency-fund lesson and is not optional.
- Real historical events surface as news cards at the timestep they occurred, **without revealing what happens next**. News content is data, not code — it lives in the scenario config or a seeded table, never hardcoded in the engine.
- `[HARD] H6`: a scenario is a named, seeded, **versioned** config. Changing a scenario creates a new version; `(name, version)` is unique and configs are never edited in place.

Define the scenario config schema (Zod) in this phase and write the v1 config for the 2019–2023 window as data. Validate it at load; a malformed config fails loudly.

### 5. Counterfactuals and debrief inputs

The debrief is the educational payload, so the engine must compute its inputs even though the UI is Phase 4:

- **"Did nothing"**: initial allocation held untouched to the end.
- **"All-index"**: the whole corpus in the large-cap index throughout.
- Both must be computed by the same valuation path as the player's portfolio, so the comparison is apples to apples. If the equity series is total-return and the gold series is price-return (verify against `DATA.md`), say so in the returned metadata so the UI can caveat it.
- **Behavioural metrics**, each a pure function over the ledger with a documented definition: over-trading (turnover relative to corpus), panic selling at troughs (sells within N steps of a local drawdown low), concentration (max single-instrument weight, time-weighted).
- `[HARD]`: the debrief is **deterministic and rule-based**. Do not call an LLM. The non-goals list bans AI-generated investment analysis presented as club output; behavioural feedback in the club's name must be reproducible and explainable.

### 6. Serialisability for Phase 4

`[HARD] H18` (a closed laptop never loses a run) is implemented in Phase 4, but only works if the engine cooperates now: `RunState` must serialise to and from JSON losslessly, including decimal quantities and the PRNG's internal state. Test round-tripping mid-run and asserting that a resumed run produces the same subsequent output as an uninterrupted one.

### 7. Golden-file tests

`[HARD] H17`, and the brief calls this "the main defence against a later AI-assisted edit quietly changing valuation logic."

- A fixed scenario, a fixed action sequence, and a committed expected-output file (full ledger plus per-step derived state).
- At least three golden runs: a passive run, an active-rebalancing run, and one that hits the expense shock and forces a sale.
- CI fails on any diff. Provide `npm run engine:regenerate-goldens` that requires an explicit confirmation flag, and document in `CLAUDE.md` that regenerating is a deliberate reviewed act with the reason recorded in the commit message.
- Golden files go in the formatter/linter ignore list, same as the snapshot data.

## Tests

Beyond the goldens: unit tests on money arithmetic and rounding at boundaries; the future-price accessor throwing; ledger-fold equivalence (full vs incremental); cache rebuild; determinism; idempotency; serialisation round-trip; rejection paths for every invalid action; the architecture test on engine imports. Update "Tested by:" for H12 (TS side), H13, H14, H15, H16, H17, and H6 (config immutability at the validation layer).

## Acceptance criteria — Phase 3 is done when

1. Golden tests pass and fail correctly when engine logic is altered (demonstrate this once, then revert).
2. A determinism test passes: same seed and inputs, byte-identical output.
3. A test proves derived portfolio state can be rebuilt from the ledger alone.
4. A test proves duplicate idempotency keys do not double-execute.
5. The engine imports nothing from app, DB, React, or Next, enforced by a test.
6. `docs/ENGINE_RULES.md` states the price rule, rounding, decimal scale, missing-bar policy, and each behavioural metric's definition.
7. `docs/phases/phase-3.md` written.

## Open questions — stop and ask before writing engine logic

1. **Missing bars.** Phase 2 removed corrupt December 2019 rows for two ETFs, so those instruments have no bar on days the calendar says traded. Recommend carrying forward the previous close and marking the entry as using a synthetic bar, so runs stay deterministic and auditable. Confirm, and confirm the same policy applies to any future removal.
2. **Timestep granularity.** A 2019–2023 window in 15–25 minutes implies monthly steps (60) or quarterly (20), not daily (~1,250). Ask which, and whether it is fixed per scenario or configurable.
3. **How allocation maps to orders.** The brief says the player "allocates across asset classes" and "may rebalance", but the schema stores `orders` with `side` and `quantity`. Does the player set target weights that the engine converts to orders, or place explicit buy/sell orders? This changes the entire action model. Recommend target weights converted server-side to orders, since it matches the game's teaching goal — but ask.
4. **Fractional units.** The brief permits fractional quantities. Real ETF and equity units are whole. Ask whether to allow fractional (simpler, keeps weights exact) or whole units with a cash remainder (realistic, teaches a real constraint).
5. **Transaction costs.** The brief never mentions brokerage, STT, or slippage. Zero costs is defensible for a long-horizon allocation game and makes over-trading costless — which undercuts the over-trading lesson. Ask whether to model a simple flat or percentage cost.
6. **Starting corpus, income, expenses, and the shock.** No figures are given. Ask for: starting corpus, income amount and cadence, routine expense amount and cadence, and whether the shock's size and timing are fixed in the config or drawn from the seed. Recommend seeded-but-bounded, so runs differ slightly while staying reproducible.
7. **Idle cash and FD interest.** Does uninvested cash earn anything? Once FD returns in a later snapshot, what are its lock-in and premature-withdrawal rules? Phase 2 correctly flagged these as engine rules with nowhere to live yet.
8. **News card sourcing.** Who writes them, and where do they live? There is no table for them in the Phase 1 schema. Recommend a JSON file in the scenario config directory, versioned with the scenario, so a content change forces a new scenario version.
9. **One ranked attempt.** §9 requires one ranked attempt per scenario version with practice mode separate and unranked. Is `runs.state` sufficient to express ranked vs practice, or does the schema need a column? This is a Phase 4 enforcement point but a Phase 3 data-model question.
10. **Dividend adjustment.** Confirm from `DATA.md` whether the fetched series is dividend-adjusted. If equities are total-return and gold is price-return, the counterfactual comparison needs a stated caveat, and the engine should surface the flag rather than the UI guessing.

---

# Phase 3 — Decisions

Append to `docs/prompts/phase-3-simulation-engine.md`. All eight blocking questions are answered. Where a recommendation was accepted with a change, the change is binding and the reasoning is given so it survives into `ENGINE_RULES.md`.

## Accepted as proposed

1. **Timestep granularity.** Monthly, 60 steps for 2019–2023, fixed per scenario in its config.
2. **Allocation to orders.** The player sets target weights; the engine converts them to orders. Orders are still written to the ledger, so the schema and audit trail are unchanged.
3. **Fractional units.** Fractional, at the `numeric(18,4)` scale already in the schema. (See the rounding exception below.)
4. **Idle cash and FD.** Idle cash earns nothing. For FD once verified: one-year lock-in, one percentage point rate reduction on premature withdrawal. Inflation is not modelled, so the cost of holding cash shows up only through the counterfactuals — note this for the Phase 4 debrief copy.
5. **News cards.** A JSON file beside the scenario config, versioned with it, so a content change forces a new scenario version. (See the hindsight rule below.)
6. **Ranked versus practice.** Add a `mode` column by forward-only migration in this phase, even though Phase 4 enforces it.

## Accepted with changes

7. **Transaction costs — 10 bps per side, not 20 bps per round trip.**
   A ledger charges at trade time, and at trade time the engine cannot know whether a buy will ever be sold, so "per round trip" is not implementable. Charge 10 bps on every trade, including the initial deployment of the corpus and any deployment of monthly income. A round trip therefore costs 20 bps as intended.
   Record in `ENGINE_RULES.md` that real Indian costs are asymmetric — roughly 3 bps to buy and 13 bps to sell delivery equity once STT, stamp duty and exchange fees are counted — and that the flat symmetric rate is a deliberate simplification, not an oversight.

8. **Quantity rounding — floor on buys, as a stated exception.**
   Converting a target weight to a quantity at scale 4 using the global half-away-from-zero rule can round up and overdraw cash by a paise. Buy quantities floor to the scale; the remainder stays in cash. Document this in `ENGINE_RULES.md` as an explicit exception to the global rounding rule, in the same place the global rule is stated, so it is not later "corrected" back.

9. **Corpus, income, expenses, shock — as proposed, plus two behaviours to define.**
   Starting corpus ₹5,00,000. Monthly income ₹25,000. Monthly expenses ₹18,000. One shock between ₹60,000 and ₹1,20,000, size and timing drawn from the seed within the middle 60% of the window.
   - **Income lands in cash.** It is not auto-invested at current weights. Deciding what to do with it each month is the game.
   - **The shock does not force a liquidation.** If the player has built a cash buffer, they absorb it without selling. The engine records which happened and the debrief reports it — that contrast is the emergency-fund lesson, and forcing a sale destroys it.

## Still to be written down — not optional

10. **The execution price rule.** With monthly steps, "next available close" is ambiguous: it could mean the close the player is looking at when deciding, or the following month's close. **Execute at the close of the step at which the decision is made.** Write in `ENGINE_RULES.md` that this is not look-ahead, because the player cannot see beyond the current step, and that executing a month later would put a month of drift between decision and fill for no educational gain.
11. **Which day a monthly step lands on.** The last trading day of the month, per the quorum calendar from Phase 2. State it once in `ENGINE_RULES.md`.
12. **The news-card hindsight rule.** Each card must be written from information available on or before its step date. A card that says a crash "would go on to" anything leaks the future in prose, and `[HARD] H15` does not cover prose. Put this in the card review checklist alongside the faculty review requirement. The engine must tolerate steps with no card, so it can be built and tested before the ~60 cards exist.

## Logistics

Merge `phase-2` into `main` first, then branch `phase-3` from `main`. Both CI jobs are green, and every branch cut from a stale `main` inherits the divergence — `design-preview` already has.

## FD series

The RBI download could not be automated: both the Handbook PDF and the data portal serve a CAPTCHA to any automated request, which is the same block the pipeline hit. The series will be downloaded from a browser by hand and committed as a raw file. Prefer the RBI Bulletin's monthly "Deposit and Lending Rates" table over the Handbook's annual table, which is as at end-March and too coarse for monthly steps. This does not block Phase 3: FD1Y is out of the v1 scenario universe.
