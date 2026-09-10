# Phase 5 — decisions, settled 10 September 2026

Answers to the open questions in `phase-5-forecasts-calibration.md`, given
before the phase was written. Phase 5 was then deferred in favour of design
preview pass 3; these stand for whichever session picks it up.

## 1. Bucketed questions — binary only, option (a)

`forecast_questions.outcome` is one `boolean` and `forecasts.probability` is
one `numeric(5,4)`. Binary needs no migration; bucketed needs a buckets table,
a probability vector, multi-category Brier and an N-way resolution UI.
Bucketed is a **recorded known gap**, not a silent omission, and the question
template must not offer an option that cannot be scored.

## 2. Unresolvable questions — a `voided` outcome

Needs a migration: the check `(resolved_at IS NULL) = (outcome IS NULL)` makes
"resolved with no outcome" unrepresentable today. Add `void_reason text`,
relax the constraint, and exclude voided questions from **both** scoring and
the participation count — a question stuck unresolved otherwise distorts every
member's count against the threshold. The reason shows on the question and the
voiding writes to the audit log (H31).

## 3. Probability granularity — integer percentages, 0 and 100 permitted

The column stores `numeric(5,4)` on `[0, 1]`, so integers land exactly as
`0.7000`; no migration either way. 0% and 100% are allowed **and the form
states the consequence**: resolving the other way scores the maximum 1.0.
Pedagogically that is the point, so it is explained rather than prevented.

## 4. Who writes the questions

Raised, unowned. The module needs a steady supply of questions through the
semester or it is an empty screen. Not a code problem, and no amount of code
fixes it.

## 5. Rationale visibility after resolution — keep it

Members read each other's reasoning once a question resolves. This is the
module's educational point and matches H4's theses-after-settlement pattern.
It has been live since Phase 1 as a clause in the `forecasts_select` policy;
it is now recorded in `CLAUDE.md` as a deliberate decision rather than an
inherited accident.

## 6. Locking a question after it opens — yes

`prompt` and `resolution_criteria` lock once `closes_at` passes or any
forecast exists, whichever is first. A genuine error is a new question plus a
voided old one, never an edit (H5).

## 7. The participation threshold — a named column, not `config_json`

`seasons` carries `min_resolved_forecasts integer`. A general `config_json`
becomes a junk drawer, and junk drawers are how handover dies; Phase 7 adds
its own named columns when it needs them. The UI states the threshold, and a
member below it sees their score marked as not yet qualifying.

## Assumptions, confirmed

- **`resolves_at` is a new column.** `closes_at` (answers lock), `resolves_at`
  (the outcome is knowable) and `resolved_at` (an admin recorded it) are three
  different dates and the schema had only two.
- **`/admin/content` is narrow**: create, list and resolve forecast questions.
  The general content admin is Phase 9; building it here doubles the phase.
