# WOWS Portal — Design Preview (out-of-sequence, throwaway)

This is **not a numbered phase**. It is a static, click-through preview of what the portal will look like, built so the team can react to the design before the backend exists. Read `CLAUDE.md` first, then this prompt.

## Ground rules

- Work on a new branch `design-preview`, branched from `main` (not from `phase-1`). Do not touch `phase-1` or `main`.
- **No backend.** No auth, no Supabase, no Drizzle, no API routes, no engine code, no new dependencies beyond what is already in `package.json`. All data is hardcoded sample data in a single `src/preview-data.ts` file.
- Every page carries a small fixed banner: **"Design preview — all figures are sample data."** This is in addition to the persistent educational footer disclaimer, which must remain on every page.
- These pages are throwaway. Later phases may borrow layout and components from them, but they are not the implementation. Say this in the branch's `docs/DESIGN_PREVIEW.md`.
- Do not run CI-breaking changes: typecheck, lint, and existing tests must still pass on the branch.
- Do not add features that aren't in the brief. Do not invent modules.

## Design direction (binding — from the brief)

- **Light, paper-toned interface.** Use the existing CSS custom-property tokens from Phase 0 (`paper`, `surface`, `ink`, `muted`, `rule`, `accent` `#5E011D`, `accent-soft`, `positive`). No dark theme.
- Oxblood carries both brand and the negative semantic; deep green carries positives. Distinguish roles by treatment, not hue: brand appears as filled surfaces (buttons, header), negatives as coloured text. `[HARD]` Never rely on colour alone for direction — every gain/loss pairs the colour with an explicit sign and an arrow.
- **Tabular lining figures** on every number: prices, returns, ranks, scores. Use the `tabular-nums` utility from Phase 0. Monospace for numeric data only, never for labels.
- Motion only for state changes that answer a user action. No scroll-entrance animations, no hover transitions on every card.
- **Density:** this is a data product. More information per screen than a marketing site, with clear grouping. Members will scan it on a phone.
- **Avoid:** warm-cream background with a serif display headline; all-caps tracked-out eyebrow labels above headings; one word in a headline coloured differently; uniform rounded cards with identical shadows for content of different importance; meta strings joined with middle dots; arrows appended to button text.
- Accessibility floor: keyboard navigable, visible focus states, sufficient contrast, respects `prefers-reduced-motion`, works at 375px width.

## Pages to build

Build these routes as static pages. Where a page has a real form in the brief, render the form but make submit show a confirmed-state message from the sample data — nothing is sent anywhere.

**Shell:** app header with logo placeholder, primary nav (Dashboard, Play, Leaderboard, Research, Learn, Events), a fake signed-in user menu, the preview banner, and the educational footer disclaimer. Mobile nav must work.

1. **`/` Landing** — what WOWS is, the four things the portal does, faculty backing, an "Apply" call to action. The no-advice policy stated plainly.
2. **`/dashboard`** — personal home: current standing across tracks, active games with progress, upcoming deadlines (a forecast closing soon), next event. Render all three states via a `?state=loading|empty|error` query param so the team can see them.
3. **`/leaderboard`** — the tracks from the brief, as tabs: **Calibration** (default and most prominent — `[HARD]` the default is _not_ raw returns), Research, Risk-adjusted, Scenario, Contribution, Overall. Each tab has a one-paragraph explanation of how it's ranked, a "last updated" timestamp, a minimum-participation note, and a table of ~15 sample members. Clicking a row expands to show the components behind the number (`[HARD]` every rank explainable). Overall shows its weights openly.
4. **`/play/allocate`** — one timestep of the allocation game: current date in the replay, portfolio value in ₹ with paise-precision formatting, allocation across asset classes with sliders or inputs, a news card for the timestep, income/expense line, "Advance" button. Include the in-simulation educational disclaimer. Plus an **end-of-run debrief** view at `/play/allocate/debrief`: final corpus, decision timeline, the "did nothing" and "all-index" counterfactual comparisons, and a short behavioural debrief (over-trading, panic selling, concentration). The debrief is the educational payload — give it the most attention on this page.
5. **`/play/forecast`** — list of open questions with close times in IST, one expanded with a 0–100 probability input and one-line rationale, a locked/submitted state, and a **calibration view**: a reliability curve (SVG is fine, no chart library) showing predicted vs. actual, with the Brier score.
6. **`/play/portfolio`** — a member's own season positions with the thesis, key risk, and falsifier shown beside performance, and an "open position" form with the 150-word thesis requirement visible. Do not show any other member's positions anywhere.
7. **`/research`** — archive list with search box and filters (vertical, company), and `/research/[slug]` with one sample note: metadata block (company, vertical, thesis, risks, falsifier, sources), markdown body, review-state chip, and the non-removable educational disclaimer at top and bottom. Include a staleness flag on one note in the list.
8. **`/learn`** — three tracks (Foundations, Applied Analysis, Quant) with ordered modules, progress indicators, one module page with markdown content, external links, and the "opens in the Python environment" link for a Quant module.
9. **`/events`** — upcoming and past sessions, one at capacity showing a waitlist button, RSVP states, an `.ics` link (can be a dead link).
10. **`/admin/audit`** — a table of sample audit entries: actor, action, entity, before/after, timestamp. This is here so the team sees that admin actions are visible, not because admin is in scope.

## Sample data rules

- Indian names, Ashoka-appropriate cohorts, Indian instruments (Nifty 50, a few large-caps by ticker, a gilt index, gold, FD). Currency in ₹ with Indian digit grouping (₹12,34,567.89).
- Every timestamp shown in IST with the zone visible.
- Keep all sample data in `src/preview-data.ts` so it can be deleted in one step.

## Deliver

- Push the branch. Vercel will create a preview deployment; report the URL.
- `docs/DESIGN_PREVIEW.md`: what was built, what is fake, and a note that this branch is not to be merged to main as-is.
- A short list of design questions the team should answer when they see it (e.g. density preference, table vs. card for the leaderboard on mobile, how much of the debrief to show at once).
