# WOWS Portal — Phase 1: Schema and Auth

This session is **Phase 1 of 12**. Phase 0 (repo, TS strict, lint, CI, Vercel deployment, `CLAUDE.md`) is merged and green. Do not do anything from Phase 2 onward. Read this entire prompt, then `CLAUDE.md`, before touching the filesystem.

## Working agreement (applies to every session)

- **One phase per session.** This session is Phase 1 only.
- **Read before writing.** Read `CLAUDE.md` and any existing schema before proposing changes.
- **Small, reviewable commits** with messages stating what changed and why.
- **If a requirement is unclear or conflicts with the code, stop and ask.** Do not invent an interpretation. Known open questions are listed at the end; several of them block work in this phase, so read them first.
- **Do not add features not in the brief.**
- **Every `[HARD]` requirement must be traceable to a test.** Update the "Tested by:" lines in `CLAUDE.md` for every invariant you cover in this phase. If one cannot be tested, say so in the summary.
- **At the end, write `docs/phases/phase-1.md`**: what was built, deferred, and any deviation from the brief.

## Decisions that must be confirmed before starting

The following were open in the brief. Ask the user for each answer before writing code that depends on it. Do not guess.

| #   | Decision                                                                                                                  | Brief's recommendation                    |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| A   | **Auth method**: Discord OAuth (if the club community runs on Discord) or email magic link restricted to `@ashoka.edu.in` | Either; never roll your own password auth |
| B   | **ORM**: Drizzle or Prisma (may already be answered from Phase 0)                                                         | Not stated                                |
| C   | **Migration owner**: ORM migrations or Supabase CLI migrations — one chain, forward-only                                  | Not stated                                |
| D   | **RLS enforcement strategy** — see open question 3 below                                                                  | "RLS or equivalent server-side scoping"   |

## Scope of this phase

- Full database schema with versioned, forward-only migrations. **Schema first**: the brief requires schema and migrations to be written and reviewed before any feature code.
- Row-level security policies.
- Auth flow with roles, resolved server-side.
- Seed script.
- Nothing user-facing beyond login/logout and a stub dashboard.

## Data model

The brief's sketch is reproduced below. It is "not prescriptive on exact columns, but these entities and their relationships should exist, and the marked invariants must hold." Build every entity listed. Do **not** invent tables for modules whose entities are absent from this sketch (quiz banks, kiosk leaderboard, announcements, applications, coverage assignments, scenario news events) — record them as gaps in your summary and raise them under open question 2.

```
users            id, auth_identity, email, display_name, cohort_year, created_at
memberships      user_id, season_id, role, vertical, status
seasons          id, name, starts_at, ends_at, state
verticals        id, name, lead_user_id

instruments      id, symbol, name, asset_class, is_active
price_bars       instrument_id, trade_date, open, high, low, close, volume, snapshot_version
                 -- [HARD] immutable; corrections create a new snapshot_version

scenarios        id, name, version, config_json, seed, universe, start_date, end_date
                 -- [HARD] (name, version) unique; configs are never edited in place

game_instances   id, scenario_id, season_id, opens_at, closes_at, state
runs             id, game_instance_id, user_id, current_step, state, started_at, completed_at
orders           id, run_id, instrument_id, side, quantity, submitted_at,
                 idempotency_key, step_index
                 -- [HARD] append-only; unique on (run_id, idempotency_key)
fills            id, order_id, price_paise, quantity, executed_at, step_index
                 -- [HARD] append-only
holdings_cache   run_id, instrument_id, quantity, as_of_step
                 -- derived only; must be fully rebuildable from orders+fills

positions        id, season_id, user_id, instrument_id, opened_at, closed_at
theses           position_id, body, key_risk, falsifier, submitted_at
                 -- [HARD] immutable after submission; edits create a new revision row

forecast_questions  id, season_id, prompt, resolution_criteria, closes_at,
                    resolved_at, outcome
forecasts           id, question_id, user_id, probability, rationale, submitted_at
                    -- [HARD] immutable after closes_at; unique on (question_id, user_id)
scores              user_id, season_id, track, value, components_json, computed_at

research_notes   id, author_id, season_id, instrument_id, body_md, state, published_at
reviews          note_id, reviewer_id, rubric_json, total, submitted_at

modules          id, track_id, order_index, body_md, state
progress         user_id, module_id, completed_at

events           id, season_id, title, starts_at, capacity, location
rsvps            event_id, user_id, state
attendance       event_id, user_id, marked_by, marked_at

audit_log        id, actor_id, action, entity_type, entity_id, before_json,
                 after_json, created_at
                 -- [HARD] append-only, never deleted
```

### Schema rules that implement `[HARD]` invariants

Enforce these **in the database**, not only in application code. Each must have a test (see Tests).

- **Money is integer paise (H12).** Every currency column is `bigint` with a `CHECK` that documents its unit in the column name (`_paise` suffix). No `numeric`, `real`, or `double precision` for currency anywhere. Fractional quantities use `numeric` with a fixed scale; state the scale and rounding rule once in `docs/ENGINE_RULES.md` (create the file with just this section; Phase 3 extends it).
- **Append-only tables (H7, H8, H31):** `price_bars`, `orders`, `fills`, `audit_log`. Revoke `UPDATE` and `DELETE` for all application roles, and add a trigger that raises on `UPDATE`/`DELETE` so even the service role cannot mutate them accidentally. `holdings_cache` is the one exception — it is derived and may be truncated and rebuilt.
- **Uniqueness (H6, H8, H10):** `scenarios (name, version)`, `orders (run_id, idempotency_key)`, `forecasts (question_id, user_id)`.
- **Immutability windows (H9, H10):** theses are immutable after submission — model this so edits create a new revision row rather than an update (the sketch's `theses` table has no revision column; add the minimum needed and note the deviation). Forecasts are immutable after `closes_at` — enforce with a trigger comparing against `now()` (server time), and see open question 6 about what happens _before_ the deadline.
- **Settled seasons (H5):** add a trigger, or a design you can defend, that rejects mutation of season-scoped rows once the season is `settled` or `archived`. If you decide this belongs in Phase 9 with the settlement action, say so explicitly rather than skipping it.
- **Season state machine:** `draft → open → closed → settled → archived`. Enforce valid transitions (a `CHECK` won't do; use a trigger or an application-level transition function that is the only write path).
- **Timestamps (H33):** every timestamp column is `timestamptz`, stored UTC. Create the single timezone conversion helper (`formatIST` or similar) in the app now, with a unit test, and document in `CLAUDE.md` that it is the only permitted conversion point.
- **Types end to end:** API/DB types are generated from the schema (ORM inference or `supabase gen types`), never hand-written. `any` is a defect.
- **Migrations** are versioned, forward-only, and committed. Provide npm scripts for `db:migrate`, `db:reset` (drop, migrate, seed — dev only), and `db:generate-types`.

## Roles and authorization

Roles (additive, server-side): `guest`, `applicant`, `member`, `lead`, `core`, `faculty`, `alum`.

| Role        | Can do                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| `guest`     | Landing, public info, apply                                                    |
| `applicant` | See own application status only                                                |
| `member`    | Play games, forecasts, research, leaderboards, curriculum                      |
| `lead`      | Member rights + create events, review research in their vertical, run games    |
| `core`      | All of the above + manage members, seasons, content, config                    |
| `faculty`   | Read-only across everything + approve/reject curriculum and published research |
| `alum`      | Read-only archive, event invites                                               |

- `[HARD] H1`: every mutating endpoint checks role server-side. Build a single `requireRole(...)` helper used by every server action / route handler, and a test that calls at least one protected mutation as the wrong role and gets a 403.
- `[HARD] H2`: RLS (or the strategy chosen in decision D) on every table with member data. The brief names three cases explicitly: another member's **open positions**, **unresolved forecasts**, and **draft research** must not be readable by manipulating an ID. Also cover `runs`, `orders`, `fills`, `theses`, `progress`, `rsvps`, and `memberships`.
- Faculty is read-only across everything: write policies that grant `SELECT` broadly and no `INSERT/UPDATE/DELETE` except on the review/approval tables that Phases 7–8 will add.
- **Where roles live** is ambiguous in the brief — see open question 1. Do not build until answered.

## Auth flow

Use Supabase Auth with the method from decision A. Do not write any password handling.

- Sign-in page, sign-out, session refresh via Next.js middleware, and route protection for `/dashboard`, `/play/*`, `/leaderboard`, `/research/submit`, `/research/mine`, `/learn`, `/events`, `/members`, `/me`, and `/admin/*` (all of these can be a single guarded layout for now; only `/dashboard` renders anything).
- On first sign-in, create the `users` row from the auth identity. What role the new user gets is open question 4.
- Stub `/dashboard`: shows display name, current season, and the user's role(s). That is all. It must have designed loading, empty (no active season), and error states — a blank screen is a defect, and a failed load must surface to the user (H34).
- Persistent footer disclaimer (already on the placeholder from Phase 0) stays on every page.
- Every request body and search param parsed through Zod before use.

## Seed script

One command (`npm run db:seed`) populates a realistic development database from a clean state. The brief specifies: **a season, twenty members, a scenario, forecast questions, sample research.**

- Twenty users spread across roles (`member` majority, at least one each of `lead`, `core`, `faculty`, `alum`, `applicant`), across two or three verticals and two cohort years.
- One `open` season plus one `settled` past season with a few rows so archive states can be tested later.
- Forecast questions in mixed states: open, closed-unresolved, resolved. Sample forecasts by several members.
- Sample research notes in mixed workflow states.
- Sample events with RSVPs at and below capacity.
- **Scenario:** a scenario row requires a universe and a price snapshot that do not exist until Phase 2. Seed a scenario row with a placeholder `config_json` and `universe` referencing seeded `instruments` rows with **no** `price_bars`, and note this clearly in the summary. See open question 5.
- Seeding must be idempotent or must refuse to run on a non-empty database — pick one, document it.
- Seed users must be able to log in during development. With magic link, use a local inbox (Supabase local dev's Inbucket/Mailpit); with Discord, this is hard in CI — see open question 7.

## Tests

- **RLS / scoping test (H2):** as member A, attempt to read member B's open position, unresolved forecast, and draft research note by ID. All three must return nothing or 403. Run this at whichever layer decision D puts the enforcement — and if enforcement is in the app layer, also run a direct-DB test proving RLS blocks it when the user's JWT is used, or document why not.
- **Role check test (H1):** wrong-role call to a mutating endpoint returns 403.
- **Append-only tests (H7, H8, H31):** `UPDATE` and `DELETE` on `price_bars`, `orders`, `fills`, `audit_log` fail at the DB level.
- **Uniqueness tests:** duplicate `(run_id, idempotency_key)` and duplicate `(question_id, user_id)` inserts fail.
- **Forecast lock test (H10, H20):** inserting/updating a forecast after `closes_at` fails, using DB server time.
- **Season transition test:** an invalid transition (e.g. `draft → settled`) is rejected.
- **Timezone helper unit test (H33).**
- **Playwright E2E — login:** the brief's "must never break" flows include _log in_. Sign in as a seeded user, land on `/dashboard`, see name and role, sign out. This must run in CI against a local Supabase instance (or a documented equivalent).
- Update `CLAUDE.md` "Tested by:" lines for H1, H2, H5 (if built), H7, H8, H10, H20 (deadline enforcement only), H31 (storage only), H33, H34 (dashboard only).

## Acceptance criteria — Phase 1 is done when

1. `db:reset` then `db:seed` produces a working database from scratch, reproducibly, with the contents above.
2. A test proves a member cannot read another member's open positions, unresolved forecasts, or draft research via a modified ID.
3. Login works end to end, covered by a Playwright test that passes in CI.
4. All DB-level invariant tests above pass in CI.
5. Generated types are committed and `typecheck` passes with zero `any`.
6. `CLAUDE.md` "Tested by:" lines updated; `docs/ENGINE_RULES.md` and `docs/phases/phase-1.md` written.

## Open questions — stop and ask

1. **Where do roles live, and are they per-season?** The brief says roles are "additive" (a user can hold several), but the data model puts a single `role` on `memberships (user_id, season_id, …)`. Meanwhile `faculty`, `alum`, and `applicant` are not naturally season-scoped, `users` has no role column, and `applicant` has no season to join. Options: (a) a global `users.role` plus a per-season `memberships.role`; (b) a `user_roles` join table; (c) per-season only, with faculty/alum given a membership in every season. Ask which. Also: `verticals.lead_user_id` and a `lead` membership with a `vertical` value are two sources of truth for who leads a vertical — ask which is canonical.
2. **"Full database schema" vs an incomplete sketch.** Phase 1 asks for the full schema, but §7 has no entities for quiz banks, the kiosk stall leaderboard, announcements, applications (needed for `applicant` status), coverage-universe assignments, scenario news cards, allocation-game income/expense events, or curriculum tracks (`track_id` is referenced but no `tracks` table). Ask whether to (a) add those tables now under "schema first", or (b) add them in their feature phases as forward-only migrations. Do not silently pick.
3. **RLS vs ORM.** If the app connects through Drizzle/Prisma using the service-role or a superuser connection, Postgres RLS is bypassed and the "equivalent server-side scoping" has to be in application code. If the app uses the Supabase client with the user's JWT, RLS applies but the ORM is largely unused. Ask which model the client wants; it changes how H2 is enforced and tested.
4. **What is a freshly signed-up user?** With `@ashoka.edu.in` magic link the brief says verification is "automatic," but the role table has `applicant` (signed up, not admitted) below `member`. Does a verified Ashoka email land as `applicant` or `member`? With Discord OAuth, who is allowed to sign in at all?
5. **Seed scenario dependency.** The seed spec requires "a scenario," but a usable scenario needs Phase 2's price snapshot. Confirm the placeholder approach above, or move the scenario seed to Phase 2.
6. **Forecast editability before the deadline.** §7 says forecasts are immutable _after_ `closes_at`; the Phase 5 acceptance criterion says "a submitted forecast cannot be edited" (full stop). Can a member revise a forecast before the deadline? This decides whether `forecasts` is upsert-until-lock or insert-once, and whether revisions need their own rows. Ask now because it is a schema decision.
7. **Login E2E in CI.** Magic-link login can be tested against local Supabase with a captured inbox. Discord OAuth cannot be driven headlessly in CI without a test bypass, which would be a second auth path. If decision A is Discord, ask how the client wants "login works end to end" to be proven.
8. **`price_bars` money columns.** The sketch lists `open, high, low, close` without a unit, while `fills.price_paise` is explicit. Confirm price bars are also integer paise (consistent with H12) — the Phase 2 ingestion script will need the same answer.
