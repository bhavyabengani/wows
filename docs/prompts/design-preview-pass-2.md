# WOWS Portal — Design Preview, pass 2: make it distinctive

Continue on the `design-preview` branch. Read `CLAUDE.md` and `docs/DESIGN_PREVIEW.md` first. The team's reaction to pass 1: it looks like a default admin template. This pass replaces the generic look with a considered one. Same ground rules as pass 1: no backend, no new dependencies unless justified in `docs/DEPENDENCIES.md` (a font is the one expected addition), all sample data stays in `src/preview-data.ts`, preview banner and educational footer on every page.

The brief's constraints are not negotiable and are the reason this cannot become a neon trading terminal: light paper surface, oxblood `#5E011D` as the only brand colour, no scroll animations, no hover effects on every card, no serif-display-on-cream, none of the generic tells listed in `CLAUDE.md`. Within those, be bold. "Restrained" is not the same as "bland."

## Before writing code: pick a direction and write it down

Write `docs/DESIGN_DIRECTION.md` first, in under a page: the reference point (e.g. the typographic authority of a broadsheet financial page, a Bloomberg-density data table set in a warm-cool paper palette, a well-designed annual report), the type pairing, the grid, and what the one signature move is. Then build to it. A design without a stated direction drifts back to template.

## Typography — this is where most of the "fancy" will come from

- Choose **two faces**: a characterful sans for interface and headlines (not Inter, not Roboto, not the system stack — something with personality that still reads on a phone), and a **monospace or tabular-figure face for numbers** with true tabular lining figures. Load them via `next/font` and justify in the dependency doc.
- Headlines large and confident, tight leading, real hierarchy: one display size, one section size, one body, one caption. No more.
- Numbers are the hero. Big portfolio values, ranks, and Brier scores set in the numeric face at display size where they are the page's subject. Currency with `₹`, Indian grouping, paise shown at smaller size and lower weight.
- Kill every all-caps tracked eyebrow label. Use size, weight, and colour for hierarchy instead.

## Colour and surface

- Use oxblood **generously** as filled surfaces: the header bar, primary buttons, the selected leaderboard tab, the current-timestep marker, the "locked" state on a forecast. It should feel like the club's colour, not an accent sprinkled on grey.
- Paper background `#F6F5F2` with white surfaces sitting on it with **rules (1px `rule` colour) instead of shadows**. No drop shadows at all. Separate content with lines and space like a printed table, not with floating cards.
- Vary card treatment by importance: the leaderboard table has no card at all (it is the page); a secondary note gets a rule; a callout gets an oxblood left rule. Identical rounded cards everywhere is the tell we're removing.
- Gains in `positive` green text with `+` and `▲`; losses in oxblood text with `−` and `▼`. Never colour alone.

## Signature moves (pick the ones that fit the direction; do all of the first three)

1. **Inline sparklines** on the dashboard, leaderboard, and portfolio rows: tiny hand-written SVG line charts of sample series, ink-coloured, no axes, one per row. This single element makes it read as a finance product.
2. **The leaderboard as a proper table**: full-width, dense, generous vertical rhythm, rank column in the numeric face, current user's row tinted oxblood at 6% opacity, the expand-for-components drawer as an inset panel on the same paper, not a modal.
3. **The allocation game timestep** laid out like a dashboard cockpit: date and portfolio value dominant top-left in display size, allocation as a single stacked horizontal bar segmented by asset class (oxblood, greens, greys, hatching for cash) with a draggable/adjustable breakdown beneath, the news card set apart with an oxblood rule, and the "Advance" button the only filled oxblood button on the screen.
4. **Landing page**: a big typographic opening statement (no hero image, no gradient), the four portal functions as a dense two-column list with real specimen numbers from the sample data, and the faculty-backing and no-advice policy set as a formal block, like a masthead.
5. **The reliability curve** on the forecast page as a hand-drawn SVG with a dotted diagonal, filled points sized by count, and the Brier score set large beside it.
6. **The debrief** as a narrative document: the counterfactual comparison as three large numbers in a row, the decision timeline as a vertical rule with events pinned to it, and the behavioural notes as short paragraphs with a leading oxblood keyword.

## Motion — one orchestrated moment per flow, nothing else

- Forecast submit: the input locks with a short transition into the filled-oxblood "Locked" state.
- Allocation advance: the portfolio value counts to its new figure over ~400ms and the timestep marker moves.
- Leaderboard row expand: the components drawer slides open.
- All respect `prefers-reduced-motion`. No hover scale, no fade-in-on-scroll, no skeleton shimmer for the loading state — use a plain static "Loading standings…" line in the interface's voice.

## Mobile

Check every page at 375px. Tables become two-line rows (name and rank on line one, the numbers on line two) rather than horizontal scroll. The allocation bar stacks vertically. Bottom nav on mobile is fine.

## Deliver

- Updated preview URL.
- `docs/DESIGN_DIRECTION.md` as above.
- Before/after screenshots of the dashboard, leaderboard, and allocation page in `docs/screenshots/` for the team.
- Update `docs/DESIGN_PREVIEW.md` with what changed and the font choice.
