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

Nothing else is needed for Phase 0. Later phases add a Supabase project; see
[`.env.example`](.env.example) for the variables that will be required.

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
cp .env.example .env.local   # optional in Phase 0: nothing is read yet
npm run dev
```

Open <http://localhost:3000>. The dev server reloads on save.

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
.github/workflows/ci.yml   CI: typecheck, lint, format, unit, e2e
docs/DEPENDENCIES.md       one justifying line per direct dependency
docs/phases/               one summary per phase (the handover record)
e2e/                       Playwright tests
src/app/                   Next.js App Router: layout, pages, globals.css (design tokens)
src/components/            React components (src/components/ui is shadcn/ui)
src/lib/                   pure helpers: time (UTC to IST), disclaimer text, utils
CLAUDE.md                  architecture, conventions, invariants, phase plan
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

### Production URL

Recorded here once the first deployment exists: _not yet deployed_.

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
