# Phase 0 — Foundation

Session date: 8 September 2026. Brief: `phase-0-foundation.md` (Phase 0 of
12).

## What was built

- **Repository scaffold.** Next.js 16 App Router, TypeScript strict with
  `noUncheckedIndexedAccess` and `noImplicitOverride`, `src/` layout, `@/*`
  alias. ESLint with `@typescript-eslint/no-explicit-any` as an error.
  Prettier. npm scripts: `typecheck`, `lint`, `format`, `format:check`,
  `test`, `test:e2e`, `build`. Node pinned to 22 via `.nvmrc` and
  `engines`.
- **Design tokens.** The eight-token palette as CSS custom properties in
  `src/app/globals.css` (`--wows-*`), feeding the shadcn/ui semantic
  variables and exposed to Tailwind v4 through its `@theme` block. A `numeric`
  utility sets `font-variant-numeric: tabular-nums`. System font stack. No
  dark theme; shadcn's `dark:` classes are bound to a `.dark` class that is
  never applied.
- **shadcn/ui** initialised (radix base, CSS variables). Init created
  `src/components/ui/button.tsx` and `src/lib/utils.ts`; nothing else was
  added.
- **Placeholder page** (`src/app/page.tsx`) proving the tokens load, with the
  persistent footer disclaimer rendered from the root layout. The disclaimer
  wording lives once, in `src/lib/disclaimer.ts`, so simulation screens and
  tests reuse it.
- **Timezone helper** `src/lib/time.ts`: the single UTC to IST conversion
  point (H33). Output is assembled from numeric `Intl` parts rather than a
  locale string after the unit tests caught two ICU quirks on the first run
  ("Sept" for September, zero-padded days).
- **Test harness.** Vitest with 14 real tests across `src/lib/time.test.ts`
  and `src/lib/repo-invariants.test.ts`. Playwright against the dev server
  with one smoke test: the page loads, has the right title and heading, and
  the footer contains the disclaimer text. Chromium only.
- **CI.** `.github/workflows/ci.yml` runs on every push and pull request:
  `npm ci`, typecheck, lint, format check, Vitest, Playwright (browsers
  installed with OS deps, cached by Playwright version). npm cache via
  `setup-node`. All actions pinned to commit SHAs. Playwright report uploaded
  on failure. Retries are zero on purpose.
- **Docs.** `CLAUDE.md` (all six sections, 38 invariants with "Tested by"
  lines), `README.md`, `.env.example`, `docs/DEPENDENCIES.md`, this file.

## `[HARD]` invariants touched in this phase

| Invariant | Status                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| H33       | Conversion correctness tested (`time.test.ts`); "one conversion point" guarded (`repo-invariants.test.ts`). Column types: Phase 1. |
| H36       | Tested: `package.json` and `docs/DEPENDENCIES.md` must agree in both directions (`repo-invariants.test.ts`).                       |
| H37       | Tested: no Python under `src/`, no Python bridge packages (`repo-invariants.test.ts`).                                             |
| H38       | Followed by hand on the placeholder; automated test deferred to Phase 11.                                                          |
| H30       | Not automatable as a positive test. Recorded as review-enforced in `CLAUDE.md`.                                                    |

All other invariants carry `not yet — Phase N` in `CLAUDE.md`, mapped to the
provisional phase plan.

## Deviations from the brief

1. **Token naming.** The brief names the tokens `paper`, `surface`, `ink`,
   `muted`, `rule`, `accent`, `accent-soft`, `positive`. They are implemented
   as `--wows-paper` ... `--wows-positive` (Tailwind `bg-wows-paper`,
   `text-wows-ink`, ...). Reason: shadcn/ui already owns `--muted` and
   `--accent` in the same `:root`, with the meaning "subtle background", and
   Tailwind's `bg-muted` / `bg-accent` are used inside shadcn components.
   Using the brief's names verbatim would have made ghost-button hovers and
   skeletons mid-grey and dropdown highlights oxblood. The prefix keeps one
   source of truth and the shadcn layer derives from it. The mapping table
   is in `CLAUDE.md` section 5.
2. **"Exposed to Tailwind via the config."** Tailwind v4 (what
   `create-next-app` ships) has no `tailwind.config.ts`; the equivalent is
   the `@theme` block in `globals.css`. That is where the tokens are exposed.
3. **`@types/node` bumped to 22** (from the scaffold's 20) to match the
   pinned Node version and satisfy Vitest 5's peer range.
4. **`shadcn` and `tw-animate-css` moved to `devDependencies`.** `shadcn
init` puts both under `dependencies`; both are build-time only (a CLI and
   a CSS import processed by Tailwind).
5. **`button.tsx` kept.** `shadcn init` now creates a Button component as
   part of initialisation. It is unused in Phase 0. It was left in place as
   "what init requires" rather than deleted and re-added later.
6. **Playwright retries set to 0** in CI. The brief asks that any failure
   fails the workflow; a retry that passes would hide a flake.

## Deferred (not done in this phase, on purpose)

- ORM, Zod, TanStack Query, Supabase client, Sentry, structured logger: none
  installed. Each is either undecided or has no consumer yet (see
  `docs/DEPENDENCIES.md`, "Deliberately not installed yet").
- Vercel deployment: **blocked on the user**. The repo is ready to import.
  See "Open questions" below.

## Open questions — decisions needed before Phase 1

Raised from the brief, not resolved here.

1. **ORM: Drizzle or Prisma?** And who owns the migration chain: the ORM or
   the Supabase CLI? Running both is a known source of drift; the brief
   requires exactly one forward-only chain.
2. **Sentry and structured logging.** Scaffold the Sentry SDK and a
   request-ID logger now (DSN blank in `.env.example`), or defer to Phase 1?
   Phase 0 deferred; `.env.example` reserves the variable names.
3. **Design tokens in Phase 0.** Done here because Tailwind and shadcn are
   set up here. Confirm, or say if they should move.
4. **Backups (H35) vs the free tier.** Supabase's free tier does not include
   scheduled backups (they start on the Pro plan, with point-in-time recovery
   as a further add-on). Either the club pays for Pro, or Phase 9 builds a
   cron-driven `pg_dump` to storage with a tested restore. This needs a
   decision and, if paid, a budget owner.
5. **Ownership.** Who owns the Vercel project, GitHub org, domain, and
   Supabase project after the founding cohort graduates? `README.md` records
   every answer as **unknown** today.

Added by this session:

6. **Phase names.** The brief says "Phase 0 of 12" and fixes only Phases 1,
   2, 9 and 11 by implication. `CLAUDE.md` carries a provisional list of all
   twelve; confirm or correct it, and the "Tested by" phase numbers will be
   updated to match.
7. **Vercel.** Create the Vercel project and import
   `github.com/bhavyabengani/wows` (steps in `README.md`, "Setting Vercel up
   from scratch"), or provide a Vercel token. Once it exists, the deployment
   will be verified and the production URL recorded in `README.md`.

## Acceptance criteria

| #   | Criterion                                                              | Status                                                                  |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | CI green on `main` running typecheck, lint, format, Vitest, Playwright | Green: <https://github.com/bhavyabengani/wows/actions/runs/34199786713> |
| 2   | Vercel deployment reachable, serving the placeholder                   | **Blocked** on the user creating the project.                           |
| 3   | `CLAUDE.md` with six sections and 38 invariants with "Tested by"       | Done.                                                                   |
| 4   | `README.md`, `.env.example`, `docs/DEPENDENCIES.md` accurate           | Done; `DEPENDENCIES.md` is test-enforced.                               |
| 5   | `docs/phases/phase-0.md` written                                       | This file.                                                              |
