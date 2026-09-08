# Phase 1 — Schema and auth

Session date: 8 September 2026. Brief: `phase-1-schema-and-auth.md` (Phase 1
of 12). Decisions A–D and open questions 1–8 were put to the user before any
schema code was written; the answers are recorded under "Decisions" below and
in `CLAUDE.md`.

## Status note (8 September 2026, end of session)

Phase 1 stopped at a safe point: every commit below passes typecheck, lint,
format check, unit tests, database tests, the login end-to-end test and the
restore drill, and CI is green on the last pushed commit.

**Where the work lives.** Phase 1 was committed directly to `main` (nine
grouped commits plus two follow-ups), the same way Phase 0 was; no
`phase-1` branch existed when the work started. A `phase-1` branch now
points at the same commits for reference. Resetting `main` back to Phase 0
would need a force-push and is the user's call, not done here.

### Done

- Schema (28 tables), three migrations, roles, triggers, 66 RLS policies.
- `withUser` connection model over the transaction pooler, verified by test.
- Magic-link auth restricted to `@ashoka.edu.in`, proxy, `requireRole`,
  dashboard stub with loading / empty / error states, core-only role grant
  endpoint.
- Seed (20 users, two seasons, all content states), production bootstrap
  script, generated types.
- Sentry scaffold and request-ID logger.
- Backup workflow, restore script, restore drill (in CI).
- Tests: 19 unit, 19 database, 4 end-to-end. CI green:
  <https://github.com/bhavyabengani/wows/actions/runs/34212391051>.
- Docs: `CLAUDE.md` (conventions, Tested-by lines), README, `.env.example`,
  `docs/ENGINE_RULES.md`, `docs/DEPENDENCIES.md`.

### Half-done (needs a human, not more code)

- **Final doc commit not on GitHub.** The commit recording the CI link
  (`8f04a34`) is committed locally but SSH to GitHub started timing out on
  ports 22 and 443 at the end of the session while HTTPS still worked. Run
  `git push origin main` from a terminal when the network allows.
- **Production Supabase project does not exist.** Until it does, the Vercel
  deployment serves public pages only and `/login` says sign-in is not set
  up. To finish: create the project, set the Vercel variables listed in
  README > Deploy, apply the magic-link template from
  `supabase/templates/magic_link.html` in the dashboard, run
  `DATABASE_URL=<prod> npm run db:migrate`, sign in once, run
  `npm run db:bootstrap-core -- <email>`.
- **Backups are dormant.** The workflow needs the three GitHub secrets, the
  private `db-backups` bucket, and `BACKUPS_ENABLED=true` (README > Backups).
- **Ownership** of GitHub, Vercel, Supabase and the domain is still
  unrecorded in README.

### Next

- Design preview (out-of-sequence, throwaway) on a `design-preview` branch
  from `main`: not started.
- Phase 2 (market data ingestion): open questions at the end of this file.
- Small follow-ups deferred to their phases: admin UI for promotions
  (Phase 10), alumni second email, `SignedFigure` component (Phase 11).

## What was built

- **Schema** (`src/db/schema.ts`, Drizzle): every entity in the brief's
  sketch plus `user_roles`, `tracks`, `applications`, a `revision` column on
  `theses`, `revised_count` on `forecasts`, and `title`/`slug` on
  `research_notes`. All timestamps `timestamptz`; all money `bigint` paise
  with a `_paise` suffix; quantities `numeric(18,4)`. RLS enabled on all 28
  tables. Generated types in `src/db/types.ts` (`npm run db:generate-types`,
  checked in CI).
- **Migrations** (`drizzle/migrations/`): `0000` generated schema; `0001`
  hand-written roles, helper functions, triggers and 66 RLS policies; `0002`
  the two `SECURITY DEFINER` auth functions. Drizzle owns the chain; the
  Supabase CLI has migrations and seeding disabled in `supabase/config.toml`.
- **Database-enforced invariants**: append-only triggers on `price_bars`,
  `orders`, `fills`, `theses`, `audit_log` (UPDATE, DELETE and TRUNCATE
  rejected for every role including `postgres`); no UPDATE on `scenarios`;
  uniqueness on `scenarios(name, version)`, `orders(run_id, idempotency_key)`,
  `forecasts(question_id, user_id)`; forecast lock at `closes_at` by server
  time with `revised_count`; season state machine `draft → open → closed →
settled → archived` with settled/archived rows frozen; settled-season
  guard on 16 season-scoped tables, direct and indirect.
- **Connection model.** `wows_app` (NOLOGIN, NOBYPASSRLS) is the only role
  application code queries as; `withUser` in `src/db/client.ts` does `SET
LOCAL ROLE` and `set_config('app.user_id', …, true)` inside each
  transaction. PostgREST roles (`anon`, `authenticated`, `service_role`) have
  all table privileges revoked, now and by default for future tables.
  `src/db/system.ts` is the only RLS-bypassing path and a test keeps it out of
  `src/app`.
- **Auth**: magic link restricted to `@ashoka.edu.in` (Zod in the form,
  decisively in `app_register_user()` in the database). `src/proxy.ts`
  refreshes the session, assigns request IDs and redirects signed-out
  visitors of member routes. `/login`, `/auth/confirm`, `/auth/sign-out`,
  guarded `(member)` layout, `/dashboard` stub with loading, empty
  (no open season / applicant) and error states. `requireRole` in
  `src/lib/auth.ts` is the single role gate; `POST /api/admin/roles` (core
  only, audit-logged) is the first mutating endpoint and how core promotes an
  applicant.
- **Sentry + logging**: `@sentry/nextjs` wired (server, edge, client,
  `onRequestError`), inert without a DSN. `src/lib/log.ts` writes one JSON
  object per line carrying the request ID.
- **Seed** (`npm run db:seed`): 3 verticals, 20 users across all roles and
  cohorts 2025–2028, one settled season with archive rows and one open
  season, a placeholder scenario with no price bars, forecast questions in
  open / closed-unresolved / resolved states with forecasts, research notes
  in all six workflow states, a curriculum track, events at and below
  capacity. Refuses to run on a non-empty database (`db:reset` for a fresh
  start).
- **Backups** (H35): `.github/workflows/backup.yml` (daily 03:00 IST +
  `workflow_dispatch`, dormant until `BACKUPS_ENABLED=true`), `scripts/backup.sh`
  (pg_dump in a `postgres:17` container, upload to the private `db-backups`
  bucket, prune older than 30 days), `scripts/restore.sh` (local targets
  only), `scripts/backup-drill.sh` (dump, wipe, restore, compare; runs in CI).
- **Tests**: 19 database tests (`npm run test:db`), 19 unit tests, 4
  Playwright tests including the full magic-link login flow via Mailpit,
  the H1 403 check, and a clean-console assertion.
- **CI** now starts local Supabase, migrates, seeds, runs the DB tests, the
  E2E suite and the restore drill, and fails if `src/db/types.ts` is stale.
- **Docs**: `docs/ENGINE_RULES.md` (numbers section), README (database, auth,
  bootstrap, backups, monthly drill), `.env.example`, `CLAUDE.md` (connection
  model, roles, forecast rule, "never `supabase db push`", Tested-by lines
  for H1, H2, H4, H5, H6, H7, H8, H9, H10, H12, H20, H31, H34, H35).

## Decisions (answers from the user, 8 September 2026)

| #   | Decision                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Email magic link restricted to `@ashoka.edu.in`. No passwords. Alumni who lose their address need a core member to add a second email later (not built).                                                                                         |
| B/C | Drizzle; Drizzle owns the single forward-only migration chain. Supabase CLI for the local instance only.                                                                                                                                         |
| D   | Both layers: RLS via `wows_app` + `SET LOCAL`, and `requireRole`. The H2 test bypasses `requireRole` on purpose.                                                                                                                                 |
| 1   | `user_roles`, additive; `applicant`/`core`/`faculty`/`alum` global, `member`/`lead` per season. `core` global so it can create the first season. Vertical lead derived from `lead` role + membership vertical; `verticals.lead_user_id` dropped. |
| 2   | Missing tables land in their feature phases, except `tracks` and `applications`, added now.                                                                                                                                                      |
| 3   | (see D)                                                                                                                                                                                                                                          |
| 4   | New sign-ups are `applicant`; core promotes. `npm run db:bootstrap-core` grants the first core in production.                                                                                                                                    |
| 5   | Placeholder scenario seeded, referencing instruments with no `price_bars`.                                                                                                                                                                       |
| 6   | Forecasts editable until `closes_at`, one row per (question, user), `revised_count` incremented on update. Phase 5's "cannot be edited" means "after `closes_at`".                                                                               |
| 7   | Login E2E runs in CI against local Supabase, reading the link from Mailpit.                                                                                                                                                                      |
| 8   | Price bars are integer paise.                                                                                                                                                                                                                    |
| —   | Backups run from GitHub Actions cron (Vercel functions have no `pg_dump`), with `workflow_dispatch`, 30-day pruning, restore only into local.                                                                                                    |

## Deviations from the brief

1. **`memberships.role` removed** in favour of `user_roles` (decision 1).
2. **`theses.revision`** added (the brief anticipated this).
3. **`research_notes.title` and `.slug`** added: `/research/[slug]` needs
   them.
4. **`scenarios.universe` kept as JSON** (array of symbols) per the sketch,
   not normalised into a join table; Phase 2 may normalise it.
5. **Settled seasons block INSERT too**, not only UPDATE/DELETE. "Corrections
   are new compensating records" therefore cannot target a settled season's
   `scores` (its primary key would collide anyway). If the club ever needs a
   post-settlement correction, a later phase adds an append-only
   adjustments table; nothing silently edits a settled season.
6. **Email domain hard-coded** in `app_register_user()` (`ashoka.edu.in`) and
   in `src/lib/schemas/auth.ts`. Two places, both tested; a config table for
   it would be scope creep.
7. **`@types/node` and TypeScript target** bumped to ES2020 so `bigint`
   literals compile (needed for paise).
8. **The backup runner is GitHub Actions, not Vercel cron** (agreed in
   review).
9. **`db:generate-types` writes Drizzle-inferred aliases** rather than
   `supabase gen types`; PostgREST is not a data path here.

## Gaps for open question 2 (not built, by decision)

Quiz banks and kiosk leaderboard (Phase 6), announcements, coverage-universe
assignments, scenario news cards and allocation-game income/expense events
(Phases 3–4), review/approval tables for curriculum (Phase 8). Each arrives
as a forward-only migration in its phase.

## Verification

- `npm run db:reset` from scratch: migrations apply, seed completes.
- `npm run test:db`: 19 passed (RLS, H4, pooler `SET LOCAL`, append-only,
  uniqueness, forecast lock, state machine, settled guard, paise columns).
- `npm run test:e2e`: login flow, domain rejection, signed-out 401/403, and
  the Phase 0 smoke test.
- `npm run db:backup-drill`: counts and policy/trigger totals match after
  wipe and restore; `wows_app` can still read.
- CI green on `main`: <https://github.com/bhavyabengani/wows/actions/runs/34212391051>
  (typecheck, lint, format, types check, unit, Supabase start, migrate + seed,
  DB tests, login E2E, restore drill).
- Vercel still serves after the push (public pages work without a Supabase
  project; `/login` explains sign-in is not set up).

## Deferred

- Admin UI for promoting applicants (Phase 10); the endpoint exists.
- Alumni second-email flow.
- A `SignedFigure` component (H38, Phase 11).
- Production Supabase project: **not yet created**; the club must create it,
  set the Vercel environment variables (README), apply the magic-link
  template, run the migrations, and run the bootstrap. Backups need the
  three GitHub secrets, the `db-backups` bucket, and `BACKUPS_ENABLED=true`
  (README > Backups).

## Open questions for Phase 2

1. **Market data source and licence.** Which provider or file format for the
   NSE history, and does the club have the right to store and replay it?
2. **Snapshot granularity.** Daily bars only, or intraday for later
   scenarios? Affects `price_bars` (currently one row per trade date).
3. **Universe normalisation.** Keep `scenarios.universe` as JSON or move to a
   join table when ingestion lands?
4. **Ownership (carried over).** Still unrecorded for GitHub, Vercel,
   Supabase and the domain.
