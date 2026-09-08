# WOWS Portal

The member portal for **Wolves of Wall Street (WOWS)**, the student finance
club at Ashoka University. One place members log into for a historical-replay
investment simulation, a forecasting log, a research hub, curriculum, events,
and leaderboards, all scoped to seasons (semesters).

No real money is involved anywhere in this product. Everything is for
education only. That is a commitment the club has made to the university in
writing, and the code treats it as a requirement.

If you are a new maintainer, read [`CLAUDE.md`](CLAUDE.md) next. It holds the
architecture, the conventions, the hard invariants, and the phase plan. Phase
summaries are in [`docs/phases/`](docs/phases/).

## What you need

- **Node 22.** The version is pinned in [`.nvmrc`](.nvmrc). With
  [nvm](https://github.com/nvm-sh/nvm) installed, run `nvm use` in the repo.
- **npm** (comes with Node). Do not use pnpm, yarn, or bun; the lockfile is
  npm's.
- **Git** and a GitHub account with access to
  [`bhavyabengani/wows`](https://github.com/bhavyabengani/wows).

- **Docker Desktop** (or another Docker engine). The local Supabase
  instance, and the backup tooling, run in containers.

## Install

```bash
git clone git@github.com:bhavyabengani/wows.git
cd wows
nvm use
npm ci
```

`npm ci` installs exactly what the lockfile says. Use `npm install <pkg>` only
when you are deliberately adding a dependency, and add its justification to
[`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) in the same commit (a unit test
fails otherwise).

## Run

```bash
npm run db:start             # local Postgres, Auth and Mailpit in Docker
npm run db:env               # write .env.local from .env.example + local keys
npm run db:reset             # wipe, migrate, seed
npm run dev
```

Open <http://localhost:3000>. The dev server reloads on save.

To sign in locally, use any seeded address (they are listed in
`scripts/seed.ts`; the core user is `aarav.mehta_ug26@ashoka.edu.in`), then
open the magic link from the local inbox at <http://127.0.0.1:54324>.

`npm run db:stop` stops the containers. `npm run db:start` needs Docker
running; the first start downloads images and takes a few minutes.

## Database

Drizzle owns the schema and the single forward-only migration chain. The
Supabase CLI only runs the local instance. **Never run `supabase db push`
or `supabase migration`**: it would fork the history.

| Command                                | What it does                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run db:generate`                  | Diff `src/db/schema.ts` against the last snapshot and write a new SQL migration.       |
| `npm run db:migrate`                   | Apply pending migrations to `DATABASE_URL`.                                            |
| `npm run db:seed`                      | Populate a clean database. Refuses if any user exists.                                 |
| `npm run db:reset`                     | Local only: wipe the database, migrate, seed.                                          |
| `npm run db:generate-types`            | Regenerate `src/db/types.ts` from the schema. CI fails if the committed copy is stale. |
| `npm run test:db`                      | Database-level tests: RLS, append-only, uniqueness, deadlines, season states.          |
| `npm run db:bootstrap-core -- <email>` | One-off: grant `core` to an existing user (see Production bootstrap).                  |
| `npm run db:restore -- <dump>`         | Restore a dump into the LOCAL database (refuses anything else).                        |
| `npm run db:backup-drill`              | Dump, wipe, restore, compare counts. Runs in CI.                                       |

Hand-written SQL (roles, triggers, policies) lives in
`drizzle/migrations/0001_roles_triggers_rls.sql` and later files. Never edit a
migration that has been applied anywhere; write a new one.

### How the app talks to Postgres

Every request runs inside a transaction that switches to the `wows_app` role
and sets `app.user_id`; row-level security policies do the scoping. The app
connects through Supabase's **transaction-mode pooler** (`DATABASE_POOLER_URL`),
which is compatible with this because `SET LOCAL` is scoped to the
transaction that Supavisor pins to one backend. Session-level `SET` would
leak between requests and is never used. Prepared statements are disabled
for the same pooler. `DATABASE_URL` (direct or session mode) is for
migrations, seed, tests and backups, which need a plain connection.

## Auth

Magic links restricted to `@ashoka.edu.in`, via Supabase Auth. No passwords
exist anywhere. The email domain is enforced twice: in the sign-in form's
schema and, decisively, inside the database function that registers users.

New sign-ups land as `applicant`. A `core` member promotes them to `member`
through `POST /api/admin/roles` (an admin UI arrives in a later phase).

Production must use the magic-link email template in
`supabase/templates/magic_link.html` (Supabase Dashboard > Authentication >
Email Templates > Magic Link). The default template sends users to the site
root with a URL fragment that the server cannot read.

### Production bootstrap (one-off)

A fresh deployment has no `core` user, so nobody can promote anyone. Once:

1. The first core member signs in at `/login` with their Ashoka email. This
   creates their portal user as `applicant`.
2. An operator with the production `DATABASE_URL` runs:

   ```bash
   DATABASE_URL='<production session-mode url>' npm run db:bootstrap-core -- their.name@ashoka.edu.in
   ```

3. They sign out and in again; the dashboard now shows `core (global)`.

The grant is written to `audit_log` with a NULL actor and the reason
"production bootstrap".

## Check your work

CI runs every one of these on every push and pull request. Run them locally
first.

| Command                | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`    | Generates Next.js route types, then `tsc --noEmit` in strict mode.   |
| `npm run lint`         | ESLint. `any` is an error.                                           |
| `npm run format:check` | Prettier, read-only. `npm run format` rewrites files.                |
| `npm test`             | Vitest unit tests (`src/**/*.test.ts`).                              |
| `npm run test:e2e`     | Playwright end-to-end tests (`e2e/`). Starts the dev server for you. |
| `npm run build`        | Production build, the same thing Vercel runs.                        |

The first time you run the end-to-end tests on a machine, install the
browser:

```bash
npx playwright install chromium
```

To see a Playwright failure, open the HTML report:

```bash
npx playwright show-report
```

## Repository layout

```
.github/workflows/ci.yml       CI: typecheck, lint, format, unit, db, e2e, restore drill
.github/workflows/backup.yml   daily production backup (dormant until enabled)
docs/DEPENDENCIES.md           one justifying line per direct dependency
docs/ENGINE_RULES.md           numeric rules: paise, quantities, rounding
docs/phases/                   one summary per phase (the handover record)
drizzle/migrations/            the migration chain (generated + hand-written SQL)
e2e/                           Playwright tests
scripts/                       seed, bootstrap, type generation, backup/restore
src/app/                       Next.js App Router pages and route handlers
src/db/                        Drizzle schema, client (RLS transactions), system path, tests
src/lib/                       env, auth (requireRole), logging, time, supabase clients
src/proxy.ts                   request IDs, session refresh, login redirects
supabase/                      local instance config and the magic-link template
CLAUDE.md                      architecture, conventions, invariants, phase plan
```

## Deploy

The app deploys to **Vercel**. There is no manual deploy step.

- Vercel is connected to the GitHub repository. Every push to `main` builds
  and deploys to production; every pull request gets a preview URL posted on
  the PR.
- The framework preset is **Next.js** (auto-detected). Build command
  `npm run build`, install command `npm ci`, Node 22. No overrides are needed.
- Environment variables live in the Vercel project settings (Settings,
  Environment Variables). Never put real values in the repo; `.env.example`
  documents the names only.
- To roll back, open the Vercel project, Deployments, choose the last good
  deployment, and Promote to Production. Then fix forward on `main`.

### Setting Vercel up from scratch

Only needed if the project is lost or moved to a new account.

1. Sign in to <https://vercel.com> with the owning account (see Ownership).
2. Add New, Project, Import the `bhavyabengani/wows` GitHub repository.
3. Accept the detected Next.js preset. Leave the root directory as `/`.
4. Add environment variables from `.env.example` as later phases require
   them. Phase 0 needs none.
5. Deploy. Confirm the placeholder page loads and the footer disclaimer is
   visible.
6. Confirm a subsequent push to `main` triggers a new deployment.

### Production environment variables

Set in Vercel from `.env.example`: `DATABASE_URL` (session-mode pooler
string), `DATABASE_POOLER_URL` (transaction-mode pooler string),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, and optionally
`NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`. Migrations are applied by
an operator with `DATABASE_URL='<production>' npm run db:migrate`; they are
not run by Vercel builds (a build must never change the database).

### Production URL

<https://wows-seven.vercel.app/> (Vercel project `wows`, connected to `main`).

## Backups

Daily `pg_dump` of production to a private Supabase Storage bucket, from
GitHub Actions (`.github/workflows/backup.yml`): 03:00 IST, plus manual runs
from the Actions tab. Dumps older than 30 days are pruned. The workflow is
**dormant** until the repository variable `BACKUPS_ENABLED` is `true`.

To enable, in the GitHub repository settings:

| Where     | Name                        | Value                                                                |
| --------- | --------------------------- | -------------------------------------------------------------------- |
| Secrets   | `SUPABASE_DB_URL`           | Session-mode pooler connection string (port 5432 on the pooler host) |
| Secrets   | `SUPABASE_URL`              | `https://<project-ref>.supabase.co`                                  |
| Secrets   | `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (Storage API upload and prune)                      |
| Variables | `BACKUPS_ENABLED`           | `true`                                                               |

And in Supabase: create a **private** Storage bucket named `db-backups`.

### Restore drill (monthly, and in CI on every push)

The restore procedure is only real if it is exercised. CI runs
`npm run db:backup-drill` against the seeded local database on every push.
Once a month, a core member also restores the **latest production dump into
a fresh local instance**, never into production:

```bash
npm run db:start && npm run db:reset           # fresh local instance
# download the newest wows-*.dump from the db-backups bucket, then:
npm run db:restore -- ~/Downloads/wows-YYYYMMDDTHHMMSSZ.dump
npm run dev                                     # sign in as yourself, check the dashboard
```

Record the date and outcome in `docs/phases/` (a one-line note in the
current phase file is enough). If the restore fails, that is a production
incident: fix the backup before anything else.

## Ownership

Who holds the keys after the founding cohort graduates. Record the answer
here; if it is unknown, say so rather than guessing.

| Asset            | Owner                                                            |
| ---------------- | ---------------------------------------------------------------- |
| GitHub repo      | `bhavyabengani` (personal account) — **long-term owner unknown** |
| Vercel project   | **unknown**                                                      |
| Supabase project | **unknown** (not yet created)                                    |
| Domain           | **unknown** (none yet)                                           |

The intended end state is a club-owned GitHub organisation and shared
accounts whose credentials are held by the current core team and the faculty
advisor, not by any individual student. Until that exists, this table is a
risk, and every handover should start by updating it.

## Contributing

- Read `CLAUDE.md` first. Then read the code you are about to change.
- One phase per session; do not pull work forward from a later phase.
- Small, reviewable commits whose messages say what changed and why.
- If a requirement is unclear, stop and ask. Do not invent an interpretation.
- Every `[HARD]` invariant in `CLAUDE.md` must be traceable to a test. Update
  its "Tested by" line when you add the test.
