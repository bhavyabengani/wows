# WOWS Portal — Phase 4: Allocation game

This session is **Phase 4 of 12**. Phases 0–3 are merged and green: repo and CI, schema with RLS and magic-link auth, snapshot `v1`, and a pure simulation engine with golden-file tests. Do not do anything from Phase 5 onward. Read this prompt, then `CLAUDE.md`, `docs/ENGINE_RULES.md`, `docs/phases/phase-3.md`, and the engine's public surface before touching the filesystem. Where this prompt and the merged code disagree, the code wins; note the difference in your summary.

## Working agreement (applies to every session)

- One phase per session. Read before writing. Small, reviewable commits.
- If a requirement is unclear or conflicts with the code, **stop and ask**. Open questions are at the end; several are design decisions that are not yours to make.
- No features beyond the brief. Every `[HARD]` requirement traceable to a test; update the "Tested by:" lines in `CLAUDE.md`.
- Every new dependency justified in `docs/DEPENDENCIES.md`.
- End with `docs/phases/phase-4.md`: built, deferred, deviations.

## What this phase is, and the one rule that governs it

This is **UI and persistence over the existing engine**. The engine is finished and correct — three golden runs, a mechanically enforced boundary, a price accessor that cannot return a series. If this phase finds itself wanting to change engine logic to make a screen work, that is a signal the screen is wrong, not the engine. Engine changes in this phase require stopping and asking, and any that happen must regenerate goldens deliberately with the reason in the commit message.

The brief is blunt about where the effort goes:

> _"The debrief is the educational payload. Spend effort there, not on the trading UI."_

Build the trading UI to be clear and unremarkable. Spend the time on the end-of-run screen.

## Carried-over context

- Monthly steps, 60 of them, 2019-01 to 2023-12, landing on the last trading day of each month.
- The player sets **target weights**; the engine converts them to orders. Income lands in cash and is not auto-invested. 10 bps per side on every trade. Buy quantities floor to scale 4, remainder stays in cash.
- Prices are **adjusted to the fetch date** (`is_adjusted`, `adjusted_as_of`, `price_basis`, `dividends_included` are on the snapshot record). Every series is **price-return**, so the game understates equity returns by roughly the dividend yield. Both facts must reach the screen — see Display honesty below.
- FD1Y is not in the v1 universe. The UI must render a universe without it and must not hardcode the asset-class list.
- The config is passed to the engine explicitly rather than stored on the run; the final step is a valuation step that completes the run; `createRun` takes step dates; snapshot reading lives in the app layer. Respect all four.

## Deliverables

### 1. `/play/allocate` — the run screen

One timestep at a time. Shows: the current date in the replay, portfolio value, current allocation, cash, the news card for this step if one exists, income and expenses for this step, and an Advance control.

- **Target-weight input.** The player adjusts weights across the available asset classes. Weights must sum to 100%; show the residual clearly rather than silently normalising. Show the resulting trades and their cost **before** the player commits, computed server-side.
- **`[HARD]` No optimistic UI.** Advancing waits for server confirmation and renders the confirmed state. Reliability requirement 7 names this explicitly for anything scored.
- **`[HARD]` No silent failures (H34).** A failed advance or rebalance surfaces with a stated next action. Never render as though it succeeded.
- Designed loading, empty, and error states in the interface's voice. A blank screen is a defect.
- Keyboard navigable, visible focus, works at 375px, respects `prefers-reduced-motion`. Most members will play on a phone.
- The educational disclaimer appears **inside** the simulation screen, not only in the footer. This is a written commitment to the university.

### 2. Persistence and resumption

`[HARD] H18`: **a closed laptop must not lose a run.** State persists server-side after every timestep.

- Write ledger entries and run state in a single transaction per advance. `orders` and `fills` are append-only (H8); the engine already produces the entries, so the app layer inserts them and does not compute them.
- `[HARD] H16`: every advance and rebalance carries a client-generated idempotency key. A duplicate returns the original result. The DB unique constraint on `(run_id, idempotency_key)` is the backstop; handle the conflict, don't let it 500.
- Resuming loads the run and continues from the persisted step. A resumed run must produce identical subsequent output to an uninterrupted one — the engine's serialisation round-trip test covers the engine side; this phase needs the equivalent through the database.
- Rate limit the advance and rebalance endpoints (reliability requirement 8).

### 3. `[HARD] H15` — no future data to the client

This is the anti-cheat requirement the whole architecture exists to serve, and it is the one most easily broken by a UI phase.

- Prices are fetched **tick by tick**. The client never receives a bar beyond the current step — not in a props payload, not in a prefetched array, not in a React Server Component's serialised tree, not in a source map, not in a TanStack Query cache warmed for later steps.
- The scenario config reaches the client only in the parts the player is allowed to see. The seed, the shock's size and timing, and the full step schedule stay server-side.
- News cards for future steps are not sent.
- **Test this at the network level**, not by reading the code: a Playwright test that intercepts every response during a partial run and asserts no date beyond the current step appears in any payload. Put the assertion on dates, not on field names, so it survives a refactor.

### 4. The debrief — where the effort goes

At `/play/allocate/debrief` (or the route the run's completion leads to). The engine already computes more than one screen should show; **which figures appear is a design decision, not an engineering one** — see open question 1. Build the screen once that is answered. The components the brief names:

- **Final corpus**, against the two counterfactuals: "did nothing" (the player's _opening_ allocation held untouched — Phase 3 fixed a bug here, do not reintroduce it) and "all-index".
- **A decision timeline** — what the player did, when, against what the market was doing.
- **A short generated debrief of behaviour**: over-trading, panic selling at troughs, concentration. `[HARD]` Deterministic and rule-based. **Do not call an LLM.** The non-goals ban AI-generated investment analysis presented as club output, and behavioural feedback in the club's name must be reproducible and explainable.
- Whether the player absorbed the expense shock from cash or was forced to liquidate. That contrast is the emergency-fund lesson.
- `[HARD]` Never rely on colour alone for direction (H38): every gain and loss pairs colour with an explicit sign and arrow.

**Display honesty.** The debrief compares asset classes, so it must state that all series are price-return and that equity returns are therefore understated by roughly the dividend yield. It must also label prices as adjusted, with `adjusted_as_of`, wherever an absolute rupee level appears. Reliance closing at ₹512 on 1 January 2019 will be noticed, and the answer needs to be on the screen rather than in a maintainer's head.

### 5. Ranked versus practice

`mode` exists on `runs` from Phase 3. §9 requires **one ranked attempt per scenario version**, with practice clearly separated and unranked. Enforce server-side: a second ranked run against the same scenario version is rejected. Practice runs are unlimited and visibly labelled as unranked throughout the run and on the debrief. See open question 3 — the reset and abandonment rules are not specified.

### 6. Design

Follow `docs/DESIGN_DIRECTION.md` and the tokens. The `design-preview` branch has a pass at these screens; **treat it as reference, not as code to merge** — it was built on hardcoded sample data with no backend. Lift layout and components deliberately, and say in your summary what you took.

## Tests

- **E2E (Playwright), the flow that must never break:** start a run, rebalance, advance several steps, close the browser mid-run, reopen, resume, complete, reach the debrief.
- **E2E, network inspection:** as in §3 above. This is an acceptance criterion, not an optional extra.
- **Idempotency through the stack:** a double-submitted advance produces one set of ledger entries.
- **Ranked-attempt enforcement:** a second ranked run on the same scenario version is rejected server-side.
- **RLS (H2):** member A cannot read member B's run, orders, fills, or debrief by ID. Extend the Phase 1 test rather than writing a new one.
- **Failed write surfaces (H34):** simulate a write failure and assert the user sees an error, not a success state.
- Update "Tested by:" for H15, H16 (through the stack), H18, H34, H38, and H2 (extended).

## Acceptance criteria — Phase 4 is done when

1. A full 60-step run completes end to end and reaches the debrief.
2. The run survives a mid-run browser close and reopen, resuming at the correct step with identical state.
3. A network inspection confirms no future prices, no future news cards, and no seed reach the client, asserted by an automated test.
4. A second ranked attempt on the same scenario version is rejected server-side.
5. All tests above pass in CI.
6. `docs/phases/phase-4.md` written, including what was taken from `design-preview`.

## Open questions — stop and ask

1. **What goes on the debrief screen.** The engine computes more than one screen should show. This is the educational payload and the design decision belongs to the club, not to you. Propose a layout with a stated hierarchy — which single figure leads, what sits beside it, what is progressive disclosure — and get it approved before building. Do not build all of it and let the screen decide.
2. **News cards do not exist.** The file is empty and has no owner. The engine tolerates steps without cards, so the game runs. Confirm whether Phase 4 ships without them (the run is playable but loses the historical texture that makes it teach) or waits. Do not write the cards yourself — they need the hindsight rule applied and faculty review, and sixty cards written by an AI in a club that has committed to faculty-reviewed content is exactly the thing the brief forbids.
3. **Practice-run rules.** Can a practice run be abandoned and restarted freely? Can a ranked run be abandoned before completion, and if so does that consume the one attempt? What happens to an abandoned run's ledger entries — they are append-only, so they cannot be deleted. Recommend: ranked runs cannot be restarted, abandonment consumes the attempt, and abandoned runs are marked in `runs.state` rather than removed. Ask before implementing.
4. **Ownership is still unrecorded.** The README has recorded GitHub, Vercel, Supabase and the domain as unknown since Phase 0. Four phases in, this is the item most likely to be forgotten and most expensive to discover later. Raise it again.

---

# Phase 4 — Decisions

Append to `docs/prompts/phase-4-allocation-game.md`. Open questions 1, 2 and 4 are answered here. Question 3 (practice-run rules) still needs the client.

## 1. Debrief layout — decided, build this

The governing constraint is the brief's own principle: **members are assessed on reasoning, not returns**, and the default leaderboard is deliberately not ranked by raw returns. A debrief that opens with "you turned ₹5,00,000 into ₹9,40,000" teaches the opposite of what the club has committed to teaching. So the lead is **the gap, not the corpus**.

A second rule governs all generated copy on this screen: **describe, never prescribe.** "You sold 62% of your equity in March 2020 and rebought in August" is a description. "You should have held" is advice, and the club has committed in writing to giving none. Every sentence the rule engine emits must survive that test. Put the test in `docs/ENGINE_RULES.md` beside the metric definitions.

### Hierarchy, top to bottom

**1 — The comparison. Three figures in a row.**
`Your corpus` / `Did nothing` / `All-index`, each a final rupee value. The **emphasised** number is not any of the three: it is the difference between the player and "did nothing", shown as both an absolute rupee figure and a percentage, with an explicit sign and arrow (H38 — never colour alone). Everything else on the row is set smaller. A player who reads only this row has learned the thing worth learning.

**2 — One behavioural finding. One sentence, one supporting number.**
Not three findings. Select the single metric with the largest deviation from its stated benchmark and render only that one, in the interface's voice, describing what happened. The selection rule is deterministic and documented; ties break by the documented order. If no metric deviates meaningfully, say so plainly rather than manufacturing a finding — "nothing in your trading pattern stands out" is a legitimate and useful result.

**3 — The shock.** One line: whether the expense shock was absorbed from cash or forced a liquidation, and if it forced one, what was sold and what that sale cost against holding. This is the emergency-fund lesson and it earns its own row.

**4 — The decision timeline.** Portfolio value across the 60 steps, with markers for trades, the shock, and steps where a news card fired. Scannable, not analytical — the player should be able to point at March 2020 and see what they did. The price-basis caveat lives here, attached to the chart: all series are price-return, so equity returns are understated by roughly the dividend yield, and levels are adjusted as of `adjusted_as_of`.

**5 — Progressive disclosure, collapsed by default.** All three behavioural metrics with their definitions and how each was computed (H23 — every number explainable to its components); the full trade list; per-asset-class contribution; counterfactual methodology.

### Mobile

Rows 1–3 stack. Row 1's three figures stay on one line if they fit at 375px, otherwise the player's figure leads and the two counterfactuals sit beneath it as a pair. The timeline scrolls horizontally with the current position anchored. Disclosure stays collapsed.

### What does not go on this screen

No ranking against other members — that is the leaderboard's job and it arrives in Phase 6. No "top picks", no suggested allocation, no next-run advice.

## 2. News cards — ships without them, with a stub

Phase 4 ships with the cards file empty. The engine tolerates steps without cards and the run is playable. Build the card slot so that a step with no card renders nothing at all — not an empty box, not a placeholder — and so that adding cards later requires no code change.

Cards are being drafted separately against this format. Build to it:

```json
{
  "step_date": "2020-03-27",
  "headline": "RBI cuts repo rate to 4.40%",
  "body": "Two sentences, present tense, contemporaneous.",
  "source_url": "https://…",
  "written_from": "2020-03-27"
}
```

`written_from` must be on or before `step_date`; add a validation check that fails the config load otherwise. That is the hindsight rule made mechanical — prose that leaks the future is not something `[HARD] H15` can catch, but a date field is.

## 3. Ownership — recorded, not resolved

GitHub, Vercel, Supabase and the domain are held on a personal account. Record in `README.md`: whose account, that it is personal, that a second owner/admin has been added on each service as recovery, and that migration to a club-owned address is pending. Replace the four "unknown" entries with this. An honest recorded answer is maintainable; "unknown" is not.
