# WOWS Portal — Phase 5: Forecasts and calibration

This session is **Phase 5 of 12**. Phases 0–4 are merged and green: repo and CI, schema with RLS and magic-link auth, snapshot `v1`, a pure simulation engine with golden-file tests, and the allocation game with persistence and a debrief. Do not do anything from Phase 6 onward — **no leaderboards**. Read this prompt, then `CLAUDE.md`, `docs/ENGINE_RULES.md`, `docs/phases/phase-4.md`, and the existing `forecast_questions` and `forecasts` schema before touching the filesystem. Where this prompt and the merged code disagree, the code wins; note the difference in your summary.

## Working agreement (applies to every session)

- One phase per session. Read before writing. Small, reviewable commits.
- If a requirement is unclear or conflicts with the code, **stop and ask**. Open questions are at the end.
- No features beyond the brief. Every `[HARD]` requirement traceable to a test; update the "Tested by:" lines in `CLAUDE.md`.
- Every new dependency justified in `docs/DEPENDENCIES.md`. This phase should need none.
- End with `docs/phases/phase-5.md`: built, deferred, deviations.

## What this phase is

> *"The club's distinguishing feature, and the mechanism that makes 'graded on reasoning, not returns' real rather than rhetorical. This module is cheap to build and is the strongest thing on the site. Do not cut it."*

Everything else on the portal has an analogue somewhere else. This does not. It is also the module a member will still be using in ten years, long after the games stop being novel, so the data model matters more than the screens.

Scoring functions get the same treatment as the engine: real unit tests with hand-computed expected values, not smoke tests.

## Carried-over context

- Forecasts are one row per `(question_id, user_id)`, editable until `closes_at`, locked by trigger after, with `revised_count` incremented on update. Phase 1 settled this; the Phase 5 acceptance criterion "a submitted forecast cannot be edited" is to be read as "cannot be edited after `closes_at`", and this phase's test must assert exactly that.
- All deadlines are enforced against **server time** (`[HARD]` H20). Timestamps stored UTC, displayed IST, through the single conversion helper from Phase 1 (H33).
- `[HARD]` No optimistic UI for anything scored (reliability requirement 7). Forecast submission waits for server confirmation and renders the confirmed state.

## Deliverables

### 1. Question admin (`/admin/content`)

Admins (`core`, and `lead` per the role table — check what Phase 1 actually built) publish questions. A question carries: prompt, resolution criteria, `closes_at`, season, and its type.

- **`[HARD]` H21: questions are about observable facts** — an index level, a policy decision, an earnings figure — **never "should I buy X."** The brief says to enforce this in the admin content guidelines *and in the question template*. Build the template so it is structurally hard to write an advice question: require a named observable, a source that will settle it, and a resolution date. Put the guideline text in the form itself, not in a wiki nobody reads. This cannot be fully enforced by code — say so in your summary rather than claiming H21 is tested when only the template is.
- **Binary or bucketed, never open-ended.** Bucketed means mutually exclusive, collectively exhaustive ranges. See open question 1 — the brief describes bucketed questions but the schema stores a single `probability` per forecast, and those two things do not fit together.
- Resolution criteria must be written before the question opens, not after the outcome is known. Make the field required at creation.
- Editing a question after it opens is a correctness hazard: members will have answered a different question. Recommend locking prompt and resolution criteria once `closes_at` has passed or any forecast exists, whichever is first, and treating a genuine error as a new question plus a voided old one (`[HARD]` H5 — corrections are compensating records, never edits). Ask before implementing.

### 2. Submission (`/play/forecast`)

- List of open questions with close times in IST and the time remaining. Answered and unanswered visibly distinct.
- Submitting takes a probability 0–100 and a one-line rationale. Both required — the rationale is the point of the module, so do not make it optional.
- Revision before `closes_at` is allowed and shows the member their current answer. Make it clear the answer is revisable until the deadline and locked after.
- **`[HARD]` H20: late submissions are rejected server-side against server time.** Never trust a client clock. The client may show a countdown, but the server decides. A submission arriving one second late is rejected with a clear message, not silently accepted.
- Locking is one of the brief's named motion moments: the input transitions into a locked state. One orchestrated moment, respecting `prefers-reduced-motion`.
- `[HARD]` H2: a member cannot read another member's unresolved forecast by manipulating an ID. This is one of the three cases the brief names explicitly. Extend the Phase 1 RLS test.
- Zod at the boundary. Reject a probability outside 0–100, a non-integer if integers are the decision, a missing rationale, an unknown question ID.

### 3. Resolution

- An admin records the outcome after the resolution date. `[HARD]` H31: every admin action changing member-visible state writes to the audit log with actor, timestamp, before and after.
- Resolution triggers Brier computation for every forecast on that question.
- **What happens to an unresolvable question** — the event did not occur, the criterion turned out ambiguous, the data source vanished — is not covered by the brief. See open question 2.
- `[HARD]` H25: all scores computed server-side from stored records. Never accept a client-submitted score.

### 4. Brier scoring

- Per forecast: the standard Brier score for a binary outcome, with the probability expressed as a fraction. Lower is better. Write the formula and the convention in `docs/SCORING.md` — this is the first entry in a file Phase 6 will extend.
- Aggregate per member per season, over resolved forecasts only.
- `[HARD]` H23: every score is explainable to its components. A member must be able to see which forecasts contributed and what each contributed.
- Minimum forecast count to qualify for the calibration track (`[HARD]` §9 minimum-participation thresholds). The threshold is a season config value, not a hardcoded number, and the UI states it. Members below it see their score marked as not yet qualifying.
- **Tests with hand-computed expected values.** A forecast of 70% on an event that happened scores 0.09. A forecast of 100% on an event that did not scores 1.0. A forecast of 50% scores 0.25 either way. Compute several by hand in the test file with the arithmetic written out in a comment, so a future reader can check the test itself.

### 5. Calibration view

The reliability curve: of everything a member said was 70% likely, how often did it happen.

- Bucket forecasts by stated probability, plot predicted against observed, with the diagonal as perfect calibration. Point size or an explicit count conveys how many forecasts sit in each bucket — a bucket with two forecasts must not look as authoritative as one with twenty.
- Hand-written SVG. Do not add a charting library for one chart.
- `[HARD]` H38: never colour alone for direction.
- State the member's aggregate Brier score beside the curve, and the number of resolved forecasts it rests on.
- **Sparse data is the normal case here**, not the edge case: a member with four resolved forecasts has a curve that means almost nothing. Design the empty and near-empty states first and make them honest — say how many more resolved forecasts are needed before the curve is meaningful, rather than drawing a confident-looking line through three points.

## Tests

- **E2E, one of the four flows that must never break:** submit a forecast before the deadline.
- **Late rejection:** a submission after `closes_at` is rejected using server time. Test it by manipulating the server-side clock or the question's deadline, not the client's.
- **Immutability after lock:** an update to a forecast after `closes_at` fails at the database level (the Phase 1 trigger) and the API returns a clear error rather than a 500.
- **Revision before lock:** an update before `closes_at` succeeds and increments `revised_count`.
- **Brier scores match hand-computed values**, per §4.
- **Aggregate correctness:** a member's season score equals the mean of their resolved forecasts' scores, tested against a hand-built fixture.
- **Minimum threshold:** a member below the threshold does not qualify.
- **RLS:** member A cannot read member B's unresolved forecast by ID.
- **Audit:** resolving a question writes an audit entry with before and after.
- Update "Tested by:" for H20, H10 (through the stack), H23 (forecast components), H25, H31 (resolution), H2 (extended), H38.

## Acceptance criteria — Phase 5 is done when

1. A late submission is rejected using server time.
2. A submitted forecast cannot be edited after `closes_at` — enforced at the database, surfaced clearly in the API and UI.
3. Brier scores match hand-computed values in a test.
4. The calibration curve renders correctly, including its sparse and empty states.
5. All tests above pass in CI.
6. `docs/SCORING.md` written; `docs/phases/phase-5.md` written.

## Open questions — stop and ask

1. **Bucketed questions do not fit the schema.** The brief says questions are "binary or bucketed", but `forecasts` stores a single `probability` and `forecast_questions` has a single `outcome`. A bucketed question needs a probability *distribution* across buckets and a Brier score generalised to multiple categories. Options: (a) build binary only in this phase and defer bucketed to a later migration, recording it as a known gap; (b) add a buckets table and a per-bucket probability now, with the multi-category Brier formula. Recommend (a) — binary is where the calibration signal is, and bucketed multiplies the scoring, UI, and resolution work. Ask, and if (a), make sure the question template does not offer a bucketed option that cannot be scored.
2. **Unresolvable questions.** What happens when an event does not occur, a criterion turns out ambiguous, or the data source disappears? A question stuck unresolved forever silently distorts every member's forecast count against the participation threshold. Recommend a `voided` outcome that excludes the question from all scoring and states the reason on the question, written to the audit log. Ask.
3. **Probability granularity.** Integer percentages 0–100, or finer? Recommend integers — finer granularity implies a precision members do not have. Also decide whether 0 and 100 are permitted: a 0% or 100% forecast that resolves the other way produces the maximum Brier score of 1.0, which is pedagogically excellent but will feel punitive. Recommend allowing them and explaining the consequence in the UI.
4. **Who writes the questions, and when?** Like the news cards, this is a content pipeline with no owner. A forecast question needs writing before its close date, which means someone must produce a steady supply through the semester. This is not a code question but it determines whether the module is alive or empty. Raise it.
5. **Rationale visibility after resolution.** H4 makes theses visible after a season settles. Nothing says whether forecast rationales become visible to other members after a question resolves. Reading how other people reasoned is most of the educational value, and the club's whole framing is reasoning over returns — but it is not specified, and it is a privacy decision. Ask; do not assume.

## Note on the previous phase

The `run_ledger_entries` deviation in Phase 4 is the right call and should stay: H13 says the ledger is the truth, and a ledger missing its cash flows is not the truth. The projection test into `orders` and `fills` is what makes it safe.

Two Phase 4 items remain open and should be tracked rather than lost: the server-computed trade preview before commit, and whether abandoning a ranked run consumes the attempt. Neither belongs in this phase; make sure both are recorded in `docs/phases/phase-4.md` as outstanding.
