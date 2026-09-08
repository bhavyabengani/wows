# CLAUDE.md — WOWS Portal

Read this file completely at the start of every session, before touching the
filesystem. It is the handover document for a volunteer-run project whose
founding cohort graduates in three years. If something here is wrong, fix it
here; do not carry the correction in your head.

Phase summaries live in `docs/phases/`. Direct dependencies are justified one
per line in `docs/DEPENDENCIES.md`. Open questions that block later phases are
listed at the end of the latest phase summary.

---

## 1. Architecture overview

### What this is

The member portal for Wolves of Wall Street (WOWS), the student finance club
at Ashoka University. It replaces MarketWatch games, Build Your Stax, WhatsApp
and Google Drive with one place members log into. It runs a historical-replay
investment simulation, a forecasting/calibration log, a research hub,
curriculum, events, and multi-track leaderboards, all scoped to **seasons**.

The club has committed the following to the university **in writing**. They
are product requirements, not disclaimers:

- No real money at any stage: no payments, brokerage linking, wallets, cash
  prizes, or paid entry.
- No buy/sell/hold recommendations under the club's name. Never surface member
  positions as suggestions, never rank "top picks", never produce a feed that
  reads as a call.
- Educational-only framing visible in the product: persistent footer
  disclaimer (`src/components/site-footer.tsx`, text in
  `src/lib/disclaimer.ts`) and a disclaimer inside every simulation screen.
- Faculty oversight: member-authored content that becomes club-visible needs a
  review state.

### Product principles

- **The ledger is the product.** Everything else is a view over it.
- **Server-authoritative, always.** The client never computes a price,
  valuation, rank, or score that matters.
- **Members are assessed on reasoning, not returns.**
- **Boring, well-trodden libraries** for anything touching money, auth, or
  state.
- **Handover-survivable.** Seeds, config, and content live in the repo or the
  database, never in someone's head.
- **The reliability bar is the point.** A wrong rank, a silently dropped
  order, or a portfolio value that changes on refresh costs the club its
  credibility. This is not a demo.

### Seasons

A season is one semester. Every game, leaderboard, forecast, thesis and
research note belongs to exactly one season. Seasons open, run, and **settle**;
once settled, nothing inside them is ever mutated again (H5). Seasons are
created and administered at `/admin/seasons`.

### The simulation engine is a pure module

The engine (market replay, order matching, ledger folding, valuation,
scoring) is a pure TypeScript module. It has **no knowledge of HTTP, React,
Next.js, Supabase, or any database**. It takes plain data in and returns plain
data out, is deterministic under a seed (H14), and is covered by golden-file
tests (H17). Route handlers and server actions call it; it never calls them.
If you find yourself importing `next/*`, `react`, or a database client inside
the engine, stop.

### Stack (decided — do not substitute)

- Next.js (App Router) + TypeScript strict, deployed on Vercel
- Supabase: Postgres, auth, row-level security, storage
- Drizzle or Prisma for schema and migrations — **not yet decided**, see open
  questions in `docs/phases/phase-0.md`; neither is installed
- Zod for boundary validation (added when the first boundary exists, Phase 1)
- Tailwind with a CSS-custom-property token layer; shadcn/ui for primitives
- TanStack Query for server state (added when first needed)
- Vitest for unit tests, Playwright for end-to-end
- Sentry for error tracking (phase pending decision)
- Python data ingestion as a standalone script (Phase 2); quant tooling as a
  separate Streamlit app (later). These are **never** merged into the Next.js
  app (H37).

### Site map

```
PUBLIC     /  /apply  /about  /research
MEMBER     /dashboard  /play/allocate  /play/portfolio  /play/forecast  /play/quiz
           /leaderboard  /research/submit  /research/mine  /research/[slug]
           /learn  /events  /members  /me
ADMIN      /admin/members  /admin/seasons  /admin/games  /admin/content
           /admin/review  /admin/audit
```

Roles: `guest`, `applicant`, `member`, `lead`, `core`, `faculty`, `alum`.

### Phase plan

Twelve phases, numbered 0 to 11. **The names below are provisional.** The
Phase 0 brief fixed only four anchors — Phase 1 is schema, Phase 2 is Python
data ingestion, Phase 9 is where backups would otherwise be discovered late,
Phase 11 chooses the typeface — and the rest were inferred from the product
surface. Confirm or correct this list before starting Phase 1, and update the
"Tested by" lines in section 4 if numbers move.

| #   | Phase                         | Scope                                                                                        |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| 0   | Foundation                    | Scaffold, tokens, test harness, CI, deployment, this file. **Done.**                         |
| 1   | Schema, auth, roles, RLS      | ORM decision, migration chain, Supabase auth, role model, RLS on every member-data table     |
| 2   | Market data ingestion         | Standalone Python script, versioned `price_bars` snapshots                                   |
| 3   | Simulation engine             | Pure module: ledger, paise money, deterministic seeded replay, golden files                  |
| 4   | Allocation game               | `/play/allocate`, order API, idempotency keys, tick-by-tick prices, persisted runs           |
| 5   | Season portfolio and theses   | `/play/portfolio`, thesis gate, immutable revisions, positions hidden until settlement       |
| 6   | Forecasting and quiz          | `/play/forecast`, `/play/quiz` kiosk sandbox, server-time deadlines                          |
| 7   | Scoring and leaderboards      | Multi-track leaderboards, explainable ranks, deterministic ties, season settlement           |
| 8   | Research, curriculum, events  | Research hub with review state and disclaimer, `/learn` with faculty gate, `/events`         |
| 9   | Admin and operations          | Audit log UI, score overrides, season export, backups and tested restore, structured logging |
| 10  | Membership and public surface | `/apply`, `/about`, `/members`, `/me`, `/dashboard`, applicant flow                          |
| 11  | Design polish and launch      | Typeface, motion, accessibility, H38 review, launch checklist                                |

---

## 2. Conventions

- **TypeScript strict**, plus `noUncheckedIndexedAccess` and
  `noImplicitOverride`. `any` is a lint **error**; it is a defect, not a
  shortcut. Reach for `unknown` and narrow.
- **Zod at every API boundary.** Every request body, search param, form
  submission, webhook, and environment variable is parsed with a Zod schema
  before it is used. Parse, don't validate.
- **Generated, not hand-written, types for API responses.** Response types are
  inferred from the Zod schema or generated from the database schema. Never
  duplicate a shape by hand.
- **Forward-only, versioned migrations.** One migration chain, one owner
  (ORM or Supabase CLI — pending decision). Never edit a migration that has
  been applied anywhere; write a new one.
- **One timezone conversion point.** Store and transport UTC. Display IST. The
  only place that converts is `src/lib/time.ts`. Nothing else may call
  `toLocale*`, `getTimezoneOffset`, or build a `Date` from a zone-less string
  (guarded by `src/lib/repo-invariants.test.ts`).
- **Money is integer paise.** Never floats, never `Number` for currency.
  Fractional quantities use a fixed-precision decimal with one stated rounding
  rule applied everywhere (Phase 3 defines it).
- **Error, loading, and empty states on every screen.** A screen is not done
  until all three exist.
- **No optimistic UI for anything scored.** Orders, forecasts, theses, quiz
  answers: the UI waits for the server's answer and shows that.
- **A failed write surfaces to the user** (H34). Never catch, log, and render
  as if it succeeded.
- **Structured logging with request IDs.** Every server log line is a JSON
  object carrying the request ID; never `console.log` a bare string in server
  code. (Logger scaffold: phase pending decision.)
- **Server components by default.** Add `"use client"` only where a hook or
  event handler needs it.
- **Naming.** Files `kebab-case.tsx`; components `PascalCase`; database
  tables and columns `snake_case`.
- **Commits.** Small and reviewable. The message says what changed and why.
- **Dependencies.** Every direct dependency has one justifying line in
  `docs/DEPENDENCIES.md` (H36, guarded by `src/lib/repo-invariants.test.ts`).

---

## 3. Working agreement (applies to every session)

- **One phase per session.** This session is Phase 0 only.
- **Read before writing.** There is no code yet, so this rule is trivial now; from Phase 1 onward, read `CLAUDE.md` and the existing schema before proposing any change.
- **Small, reviewable commits** with messages stating what changed and why.
- **If a requirement is unclear or conflicts with something, stop and ask.** Do not invent an interpretation. Silent interpretation is how small overlooked details accumulate. A list of known open questions is at the end of this prompt — raise those first.
- **Do not add features not in the brief.** Scope creep in a volunteer-run project is fatal.
- **Every `[HARD]` requirement must be traceable to a test.** If one cannot be tested, say so explicitly in your summary rather than quietly skipping it.
- **At the end of the session, write a short summary** (`docs/phases/phase-0.md`): what was built, what was deferred, any deviation from the brief. This is the handover document accumulating in real time.

_(Reproduced verbatim from the Phase 0 brief. "This session is Phase 0 only"
and "`docs/phases/phase-0.md`" read as "this session is Phase N only" and
"`docs/phases/phase-N.md`" for later phases. "The end of this prompt" refers
to the open-questions list each phase brief carries; the current list is at
the end of the latest `docs/phases/phase-N.md`.)_

---

## 4. `[HARD]` invariants

Every item below is a hard requirement. Each carries a "Tested by" line.
When you add the test, replace `not yet — Phase N` with the test file and
name. If an item cannot be covered by an automated test, the line says how it
is enforced instead.

**Authorization and access**

- H1. Every mutating endpoint checks role server-side. Hiding a button is not authorization.
  - Tested by: not yet — Phase 1
- H2. Row-level security or equivalent server-side scoping on every table containing member data. A member cannot read another member's open positions, unresolved forecasts, or draft research by manipulating an ID. There must be an explicit test.
  - Tested by: not yet — Phase 1
- H3. Kiosk (quiz) mode is strictly sandboxed from member accounts and cannot write to member records.
  - Tested by: not yet — Phase 6
- H4. No member's live season-portfolio positions are visible to other members while open; theses become visible after the season settles.
  - Tested by: not yet — Phase 5

**Seasons and immutability**

- H5. Nothing that is settled may be mutated afterward. Corrections are new compensating records, never edits.
  - Tested by: not yet — Phase 7
- H6. A scenario version is pinned to a leaderboard; changing a scenario creates a new version. `(name, version)` unique; configs never edited in place.
  - Tested by: not yet — Phase 4
- H7. `price_bars` are immutable; corrections create a new `snapshot_version`.
  - Tested by: not yet — Phase 2
- H8. `orders`, `fills`, and `audit_log` are append-only. `orders` unique on `(run_id, idempotency_key)`. `audit_log` is never deleted.
  - Tested by: not yet — Phase 4
- H9. Theses are immutable after submission; edits create a new revision row.
  - Tested by: not yet — Phase 5
- H10. Forecasts are immutable after `closes_at`; unique on `(question_id, user_id)`.
  - Tested by: not yet — Phase 6

**Simulation engine**

- H11. Market data is historical replay over a pinned, versioned snapshot — never live prices.
  - Tested by: not yet — Phase 3
- H12. All money is integer paise. Never floats, never `Number` for currency. Fractional quantities use a fixed-precision decimal with one stated rounding rule applied everywhere.
  - Tested by: not yet — Phase 3
- H13. Append-only transaction ledger; portfolio state is derived by folding the ledger, never a mutable balance. Any cache must be rebuildable from scratch by a single command.
  - Tested by: not yet — Phase 3
- H14. Deterministic and seeded: same seed + same inputs = byte-identical output, with a test asserting it.
  - Tested by: not yet — Phase 3
- H15. The client never receives future data — not in hidden fields, preloaded arrays, or source maps. Prices are fetched tick-by-tick.
  - Tested by: not yet — Phase 4
- H16. Idempotent order submission: every order carries a client-generated idempotency key; a duplicate key returns the original result.
  - Tested by: not yet — Phase 4
- H17. Golden-file tests: fixed scenario, fixed action sequence, committed expected output; any engine change that alters output fails CI until the golden file is deliberately regenerated.
  - Tested by: not yet — Phase 3
- H18. Allocation runs persist server-side after every timestep; a closed laptop never loses a run.
  - Tested by: not yet — Phase 4

**Scoring and integrity**

- H19. Opening a season-portfolio position requires a written thesis (min length, e.g. 150 words) with reasoning, key risk, and an explicit falsifier.
  - Tested by: not yet — Phase 5
- H20. Forecast submissions lock at the deadline; late submissions rejected server-side against server time. All deadlines enforced against server time.
  - Tested by: not yet — Phase 6
- H21. Forecast questions are about observable facts, never "should I buy X."
  - Tested by: not yet — Phase 6 (question authoring is admin-gated; the test covers the schema constraint and the review step, the wording itself is enforced by faculty review)
- H22. The default, most prominent leaderboard is not ranked by raw returns.
  - Tested by: not yet — Phase 7
- H23. Every rank is explainable to its components; no opaque scores.
  - Tested by: not yet — Phase 7
- H24. Ties broken by a deterministic, documented rule, never database row order.
  - Tested by: not yet — Phase 7
- H25. All scores computed server-side from stored records; never accept a client-submitted score.
  - Tested by: not yet — Phase 7
- H26. Admin score overrides always write to the audit log with a required reason.
  - Tested by: not yet — Phase 9

**Content and compliance**

- H27. Every published research note carries an automatic, non-removable educational disclaimer.
  - Tested by: not yet — Phase 8
- H28. No research note may contain a price target framed as a call to action.
  - Tested by: not yet — Phase 8 (the review state and a lint on submission are testable; the judgement call is faculty review)
- H29. Curriculum content has a publication state gated on faculty approval.
  - Tested by: not yet — Phase 8
- H30. Do not build a forum, chat, or DM system.
  - Tested by: not automatable as a positive test. Enforced by review at every phase: no messaging routes, tables, or components may be added. `src/lib/repo-invariants.test.ts` may grow a route-name guard once the router has real routes (Phase 1).

**Admin and operations**

- H31. Audit log: every admin action that changes member-visible state is recorded with actor, timestamp, before, after; viewable in-app.
  - Tested by: not yet — Phase 9
- H32. One-command data export of an entire season to JSON or CSV.
  - Tested by: not yet — Phase 9
- H33. Timestamps stored in UTC, displayed in IST, with one conversion point in the codebase.
  - Tested by: `src/lib/time.test.ts` (conversion correctness) and `src/lib/repo-invariants.test.ts` ("one conversion point": no timezone APIs outside `src/lib/time.ts`). Storage-side UTC column types: not yet — Phase 1.
- H34. A failed write surfaces to the user. Never catch, log, and render as if it succeeded.
  - Tested by: not yet — Phase 4 (first scored write)
- H35. Automated daily database backup with a documented, _tested_ restore procedure.
  - Tested by: not yet — Phase 9. **Open question:** the Supabase free tier may not include scheduled backups; see `docs/phases/phase-0.md`.
- H36. Every dependency added must be justified.
  - Tested by: `src/lib/repo-invariants.test.ts` (every direct dependency in `package.json` has a line in `docs/DEPENDENCIES.md`, and vice versa).
- H37. Python quant tooling is never merged into the Next.js app.
  - Tested by: `src/lib/repo-invariants.test.ts` (no Python files under `src/`, no Python bridge packages in `package.json`).

**Design**

- H38. Never rely on colour alone for direction: always pair with an explicit sign and arrow.
  - Tested by: not yet — Phase 11 (a shared `SignedFigure` component with a unit test that the rendered text contains the sign; visual review for the rest). The Phase 0 placeholder follows the rule by hand.

---

## 5. Design direction

**Light, paper-toned interface.** The brand oxblood `#5E011D` has very low
luminance and cannot carry accent duty on a dark surface, so a dark
trading-terminal look is explicitly ruled out. There is no dark theme.

**Tokens** are CSS custom properties in `src/app/globals.css`, one source of
truth (`--wows-*`) feeding the shadcn semantic layer and Tailwind utilities:

| Token         | Hex       | Use                                         | CSS variable         | Tailwind                |
| ------------- | --------- | ------------------------------------------- | -------------------- | ----------------------- |
| `paper`       | `#F6F5F2` | Page background — cool, slightly grey paper | `--wows-paper`       | `bg-wows-paper`         |
| `surface`     | `#FFFFFF` | Cards, tables, panels                       | `--wows-surface`     | `bg-wows-surface`       |
| `ink`         | `#1A1418` | Primary text                                | `--wows-ink`         | `text-wows-ink`         |
| `muted`       | `#6B6469` | Secondary text, labels                      | `--wows-muted`       | `text-wows-muted`       |
| `rule`        | `#E3DFDA` | Borders, table rules, dividers              | `--wows-rule`        | `border-wows-rule`      |
| `accent`      | `#5E011D` | Brand, primary buttons, negative figures    | `--wows-accent`      | `bg-wows-accent`        |
| `accent-soft` | `#8C1030` | Hover/pressed states, links                 | `--wows-accent-soft` | `text-wows-accent-soft` |
| `positive`    | `#14603C` | Gains                                       | `--wows-positive`    | `text-wows-positive`    |

The `wows-` prefix exists because shadcn already uses `--muted` and
`--accent` to mean _backgrounds_; the prefix keeps the two layers from
colliding. Prefer shadcn semantics (`bg-background`, `text-foreground`,
`text-muted-foreground`, `border-border`, `bg-primary`) for chrome, and the
`wows-*` utilities where the brand meaning matters (figures, links).

**Numerals.** Apply the `numeric` utility (`font-variant-numeric:
tabular-nums`) to every cell, figure, and column of numbers. Pair coloured
figures with an explicit sign and arrow (H38): `▲ +2,340.50`, `▼ −1,120.25`.

**Typeface.** System stack until Phase 11. The chosen face **must have proper
tabular lining figures**. A serif display face is not the default move; the
interface is a working tool, not a prospectus.

**Motion** only for state changes that answer a user action (a row updating
after an order fills, a panel opening). No ambient animation, no scroll
effects, no shimmer.

**Avoid:**

- all-caps, tracked-out "eyebrow" labels
- one word coloured differently in a headline
- uniform rounded cards with identical shadows
- meta strings joined with middle dots
- arrows appended to button text
- warm-cream-plus-serif-display

---

## 6. Explicit non-goals

- No real money, payments, wallets, or brokerage linking.
- No live trading against a real-time feed.
- No recommendations, top picks, copy-trading, or visible open positions.
- No forum, chat, or DMs (the club uses Discord).
- No mobile app.
- No in-browser Python.
- No public API.
- No cash prizes.
- No AI-generated investment analysis presented as club output.
