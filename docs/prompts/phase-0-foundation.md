# WOWS Portal — Phase 0: Foundation

You are building the member portal for Wolves of Wall Street (WOWS), a student finance club at Ashoka University. This session is **Phase 0 of 12**. Do not do anything from later phases. Read this entire prompt before touching the filesystem.

## Working agreement (applies to every session)

- **One phase per session.** This session is Phase 0 only.
- **Read before writing.** There is no code yet, so this rule is trivial now; from Phase 1 onward, read `CLAUDE.md` and the existing schema before proposing any change.
- **Small, reviewable commits** with messages stating what changed and why.
- **If a requirement is unclear or conflicts with something, stop and ask.** Do not invent an interpretation. Silent interpretation is how small overlooked details accumulate. A list of known open questions is at the end of this prompt — raise those first.
- **Do not add features not in the brief.** Scope creep in a volunteer-run project is fatal.
- **Every `[HARD]` requirement must be traceable to a test.** If one cannot be tested, say so explicitly in your summary rather than quietly skipping it.
- **At the end of the session, write a short summary** (`docs/phases/phase-0.md`): what was built, what was deferred, any deviation from the brief. This is the handover document accumulating in real time.

## Context you need

The portal replaces MarketWatch games, Build Your Stax, WhatsApp, and Google Drive with one place members log into. It runs a historical-replay investment simulation, a forecasting/calibration log, a research hub, curriculum, events, and multi-track leaderboards, all scoped to seasons (semesters).

The club has committed the following to the university **in writing**. They are product requirements, not disclaimers:

- No real money at any stage: no payments, brokerage linking, wallets, cash prizes, or paid entry.
- No buy/sell/hold recommendations under the club's name. Never surface member positions as suggestions, never rank "top picks," never produce a feed that reads as a call.
- Educational-only framing visible in the product: persistent footer disclaimer and a disclaimer inside every simulation screen.
- Faculty oversight: member-authored content that becomes club-visible needs a review state.

Product principles: the ledger is the product and everything else is a view over it; server-authoritative always (the client never computes a price, valuation, rank, or score that matters); members are assessed on reasoning, not returns; boring, well-trodden libraries for anything touching money, auth, or state; handover-survivable — the founding cohort graduates in three years, so seeds, config, and content live in the repo or database, never in someone's head.

**The reliability bar is the point.** This is not a demo. A wrong rank, a silently dropped order, or a portfolio value that changes on refresh costs the club its credibility.

## Stack (decided — do not substitute)

- **Next.js (App Router) + TypeScript strict**, deployed on **Vercel**
- **Supabase** — Postgres, auth, RLS, storage
- **Drizzle or Prisma** for schema and migrations — _not yet decided, see open questions; do not install either in this phase_
- **Zod** for boundary validation
- **Tailwind** with a CSS-custom-property token layer; **shadcn/ui** for primitives
- **TanStack Query** for server state
- **Vitest** for unit tests, **Playwright** for end-to-end
- **Sentry** for error tracking
- Python data ingestion as a standalone script (Phase 2); quant tooling as a separate Streamlit app (later). `[HARD]` These are never merged into the Next.js app.

`[HARD]` **Every dependency added must be justified.** Keep a `docs/DEPENDENCIES.md` with one line per direct dependency saying what it is for. Do not add anything beyond what the stack above and this phase's tasks require.

## Tasks

### 1. Repository scaffold

- Initialise a Next.js App Router project in TypeScript. `tsconfig` in `strict` mode; additionally enable `noUncheckedIndexedAccess` and `noImplicitOverride`.
- ESLint with `@typescript-eslint/no-explicit-any` as an **error** (`any` is a defect per the brief). Prettier for formatting. Both runnable via npm scripts (`lint`, `format:check`, `typecheck`).
- Tailwind configured with the design tokens below as CSS custom properties, exposed to Tailwind via the config. shadcn/ui initialised (no components added yet beyond what init requires). Do **not** build any UI in this phase beyond a single placeholder page that renders the footer disclaimer and proves the tokens load.
- `.env.example` listing every environment variable the app will read, with comments. **Never commit real secrets.** A `.gitignore` covering `.env*.local`, `node_modules`, `.next`, Playwright artefacts.
- `README.md`: how to install, run, test, and deploy. Written for a student who joins in two years with no context.

### 2. Design tokens (config only, no UI)

Structure the palette as CSS custom properties so a single variable change propagates everywhere. The interface is **light, paper-toned**: the brand oxblood `#5E011D` has very low luminance and cannot carry accent duty on a dark surface, so a dark trading-terminal look is explicitly ruled out.

| Token         | Hex       | Use                                                         |
| ------------- | --------- | ----------------------------------------------------------- |
| `paper`       | `#F6F5F2` | Page background — cool, slightly grey paper, not warm cream |
| `surface`     | `#FFFFFF` | Cards, tables, panels                                       |
| `ink`         | `#1A1418` | Primary text                                                |
| `muted`       | `#6B6469` | Secondary text, labels                                      |
| `rule`        | `#E3DFDA` | Borders, table rules, dividers                              |
| `accent`      | `#5E011D` | Brand, primary buttons, negative figures                    |
| `accent-soft` | `#8C1030` | Hover/pressed states, links                                 |
| `positive`    | `#14603C` | Gains                                                       |

Also add a global utility for numeric cells that sets `font-variant-numeric: tabular-nums`. Font selection is deferred to Phase 11 — use the system stack for now, but note in `CLAUDE.md` that the chosen face must have proper tabular lining figures, and that a serif display face is not the default move.

### 3. Test harness

- Vitest configured with one real (non-trivial) unit test so the harness is proven — e.g. a test for the timezone helper stub or a pure utility you create for this purpose. Do not commit a `expect(true).toBe(true)` test.
- Playwright configured against the dev server with one smoke test: the placeholder page loads and contains the disclaimer text. Playwright browsers must install in CI.

### 4. CI

GitHub Actions workflow that runs **on every push and pull request**: install, `typecheck`, `lint`, `format:check`, Vitest, Playwright. Any failure fails the workflow. Cache dependencies. Pin action versions.

### 5. Deployment

An empty deployment live on Vercel. You cannot create the Vercel account or link the repo yourself — **stop and ask the user to do that** (or to provide a token) once the repo is ready, then verify the deployment is reachable and returns the placeholder page. Document the deploy process in `README.md`, including who owns the Vercel project (see open questions).

### 6. `CLAUDE.md`

This is the most important file in this phase. It is read at the start of every future session. It must contain:

1. **Architecture overview** — the site map below, the season concept, the principle that the simulation engine is a pure module with no knowledge of HTTP/React/DB, and the phase plan (list the 12 phases by name).
2. **Conventions** — TS strict, no `any`, Zod at every API boundary, generated (not hand-written) types for API responses, forward-only versioned migrations, one timezone conversion point (store UTC, display IST), money as integer paise, error/loading/empty states on every screen, no optimistic UI for anything scored, structured logging with request IDs.
3. **The working agreement** (the section at the top of this prompt), verbatim.
4. **The complete `[HARD]` invariant list** below, verbatim, each with a "Tested by:" line that says `not yet — Phase N` until a test exists. Future sessions update this file when they add the test.
5. **Design direction summary** — light paper interface, tokens, tabular numerals, motion only for state changes answering a user action, and the list of things to avoid: all-caps tracked-out eyebrow labels, one word coloured differently in a headline, uniform rounded cards with identical shadows, meta strings joined with middle dots, arrows appended to button text, warm-cream-plus-serif-display.
6. **Explicit non-goals** — no real money/payments/wallets/brokerage; no live trading against a real-time feed; no recommendations, top picks, copy-trading, or visible open positions; no forum/chat/DMs (use Discord); no mobile app; no in-browser Python; no public API; no cash prizes; no AI-generated investment analysis presented as club output.

#### Site map (for `CLAUDE.md`)

```
PUBLIC     /  /apply  /about  /research
MEMBER     /dashboard  /play/allocate  /play/portfolio  /play/forecast  /play/quiz
           /leaderboard  /research/submit  /research/mine  /research/[slug]
           /learn  /events  /members  /me
ADMIN      /admin/members  /admin/seasons  /admin/games  /admin/content
           /admin/review  /admin/audit
```

Roles: `guest`, `applicant`, `member`, `lead`, `core`, `faculty`, `alum`.

#### Complete `[HARD]` invariant list (for `CLAUDE.md`)

**Authorization and access**

- H1. Every mutating endpoint checks role server-side. Hiding a button is not authorization.
- H2. Row-level security or equivalent server-side scoping on every table containing member data. A member cannot read another member's open positions, unresolved forecasts, or draft research by manipulating an ID. There must be an explicit test.
- H3. Kiosk (quiz) mode is strictly sandboxed from member accounts and cannot write to member records.
- H4. No member's live season-portfolio positions are visible to other members while open; theses become visible after the season settles.

**Seasons and immutability**

- H5. Nothing that is settled may be mutated afterward. Corrections are new compensating records, never edits.
- H6. A scenario version is pinned to a leaderboard; changing a scenario creates a new version. `(name, version)` unique; configs never edited in place.
- H7. `price_bars` are immutable; corrections create a new `snapshot_version`.
- H8. `orders`, `fills`, and `audit_log` are append-only. `orders` unique on `(run_id, idempotency_key)`. `audit_log` is never deleted.
- H9. Theses are immutable after submission; edits create a new revision row.
- H10. Forecasts are immutable after `closes_at`; unique on `(question_id, user_id)`.

**Simulation engine**

- H11. Market data is historical replay over a pinned, versioned snapshot — never live prices.
- H12. All money is integer paise. Never floats, never `Number` for currency. Fractional quantities use a fixed-precision decimal with one stated rounding rule applied everywhere.
- H13. Append-only transaction ledger; portfolio state is derived by folding the ledger, never a mutable balance. Any cache must be rebuildable from scratch by a single command.
- H14. Deterministic and seeded: same seed + same inputs = byte-identical output, with a test asserting it.
- H15. The client never receives future data — not in hidden fields, preloaded arrays, or source maps. Prices are fetched tick-by-tick.
- H16. Idempotent order submission: every order carries a client-generated idempotency key; a duplicate key returns the original result.
- H17. Golden-file tests: fixed scenario, fixed action sequence, committed expected output; any engine change that alters output fails CI until the golden file is deliberately regenerated.
- H18. Allocation runs persist server-side after every timestep; a closed laptop never loses a run.

**Scoring and integrity**

- H19. Opening a season-portfolio position requires a written thesis (min length, e.g. 150 words) with reasoning, key risk, and an explicit falsifier.
- H20. Forecast submissions lock at the deadline; late submissions rejected server-side against server time. All deadlines enforced against server time.
- H21. Forecast questions are about observable facts, never "should I buy X."
- H22. The default, most prominent leaderboard is not ranked by raw returns.
- H23. Every rank is explainable to its components; no opaque scores.
- H24. Ties broken by a deterministic, documented rule, never database row order.
- H25. All scores computed server-side from stored records; never accept a client-submitted score.
- H26. Admin score overrides always write to the audit log with a required reason.

**Content and compliance**

- H27. Every published research note carries an automatic, non-removable educational disclaimer.
- H28. No research note may contain a price target framed as a call to action.
- H29. Curriculum content has a publication state gated on faculty approval.
- H30. Do not build a forum, chat, or DM system.

**Admin and operations**

- H31. Audit log: every admin action that changes member-visible state is recorded with actor, timestamp, before, after; viewable in-app.
- H32. One-command data export of an entire season to JSON or CSV.
- H33. Timestamps stored in UTC, displayed in IST, with one conversion point in the codebase.
- H34. A failed write surfaces to the user. Never catch, log, and render as if it succeeded.
- H35. Automated daily database backup with a documented, _tested_ restore procedure.
- H36. Every dependency added must be justified.
- H37. Python quant tooling is never merged into the Next.js app.

**Design**

- H38. Never rely on colour alone for direction: always pair with an explicit sign and arrow.

## Acceptance criteria — Phase 0 is done when

1. CI is green on the main branch, running typecheck, lint, format check, Vitest, and Playwright on every push.
2. The Vercel deployment is reachable and serves the placeholder page.
3. `CLAUDE.md` exists with all six sections above, including all 38 `[HARD]` invariants with "Tested by:" lines.
4. `README.md`, `.env.example`, and `docs/DEPENDENCIES.md` exist and are accurate.
5. `docs/phases/phase-0.md` summary written.

## Open questions — stop and ask before proceeding on the affected task

These are ambiguities in the brief. Do not resolve them yourself.

1. **ORM: Drizzle or Prisma?** The brief leaves it open. Do not install either in Phase 0; ask so Phase 1 can start with the answer. Related: Supabase has its own CLI migration system. The brief requires _one_ forward-only versioned migration chain — ask whether migrations will be owned by the ORM or by the Supabase CLI, because running both is a known source of drift.
2. **Sentry and structured logging** are reliability requirements but are not assigned to any phase. Ask whether to scaffold the Sentry SDK and a request-ID logger now (with the DSN left blank in `.env.example`) or defer to Phase 1.
3. **Design tokens** are likewise not assigned to a phase. This prompt puts the token layer in Phase 0 because Tailwind/shadcn are set up here. Confirm, or defer.
4. **Backups (H35)** require automated daily backups. The stack is chosen for free tiers; verify whether the Supabase plan the club will use includes scheduled backups. If it does not, this `[HARD]` requirement conflicts with the stack choice and needs a decision (paid tier, or a cron-driven `pg_dump` to storage). Raise this now so it is not discovered at Phase 9.
5. **Ownership.** Who owns the Vercel project, GitHub org, domain, and Supabase project after the founding cohort graduates? Record the answer in `README.md`; if unknown, record that it is unknown.
