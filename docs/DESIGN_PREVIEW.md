# Design preview

Branch `design-preview`, branched from the Phase 0 commit on `main`
(`d39734a`). **Throwaway.** It exists so the team can react to the look,
density and flows before the backend shapes them. Later phases may borrow
layout and components from it, but this branch is **not the implementation
and is not to be merged to `main` as-is.**

## Why it branches from Phase 0, not the current `main`

The preview's ground rules are "no auth, no Supabase, no Drizzle, existing
tests must pass". `main` had already received Phase 1 (auth, RLS, a login
end-to-end test that expects `/dashboard` behind a sign-in) when the preview
was built. A static `/dashboard` cannot satisfy that test, so the branch
starts from the last Phase 0 commit, where both rules hold.

## What was built

Every route in the brief, as static pages with hardcoded sample data:

| Route                           | What it shows                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                             | What WOWS is, the four things the portal does, faculty oversight, apply, the no-advice policy stated plainly.                                         |
| `/dashboard`                    | Standing across tracks, active game with progress, deadlines, next event. `?state=loading`, `empty`, `error` render the other states.                 |
| `/leaderboard`                  | Six tracks as tabs, Calibration default. Method paragraph, last updated, minimum note, table; rows expand to their components. Overall shows weights. |
| `/play/allocate`                | One replay step: date, corpus, class sliders that must total 100%, news card, cash lines, Advance (shows a saved state). In-simulation disclaimer.    |
| `/play/allocate/debrief`        | Final corpus vs did-nothing and all-index, four behaviours with rupee cost, decision timeline with flags, what to try next.                           |
| `/play/forecast`                | Open, submitted and locked questions in IST; probability slider and rationale; SVG reliability curve with Brier score.                                |
| `/play/portfolio`               | Own positions with thesis, key risk and falsifier beside performance; open-position form with the 150-word gate.                                      |
| `/research`, `/research/[slug]` | Search and filters, staleness flag, review-state chips; note page with metadata block, body, disclaimer top and bottom.                               |
| `/learn`, `/learn/[slug]`       | Three tracks with progress; a module page with content, links and the Python-environment link on Quant modules.                                       |
| `/events`                       | Upcoming and past, one at capacity with a waitlist button, RSVP state changes, `.ics` dead link.                                                      |
| `/admin/audit`                  | Actor, action, entity, before, after, timestamp, reason.                                                                                              |

Shell: header with logo placeholder, primary nav, fake user menu, mobile
navigation (Radix Dialog), the fixed preview banner, and the persistent
educational footer from Phase 0.

## What is fake

Everything. All figures come from `src/preview-data.ts` and can be deleted
in one step. Forms never send anything; "Advance", "Submit forecast", "Open
position" and RSVP buttons only flip local state. Links marked `#` are dead.
Nothing is read from a server, and no dependency was added.

Two small pieces are real and worth keeping:

- `src/lib/format.ts`: Indian digit grouping for paise and basis points,
  with unit tests.
- `src/components/preview/ui.tsx`: `SignedFigure` (sign + arrow + colour,
  H38), `When` (goes through the one timezone conversion point), table
  classes and the in-simulation disclaimer.

## Design questions for the team

1. **Density.** The leaderboard and audit tables are set at 14px with tight
   rows. Too dense on a phone, or about right for a data product?
2. **Leaderboard on mobile.** Table with horizontal scroll (as built) or
   stacked cards per member? Cards read better; tables compare better.
3. **Debrief.** Currently everything is on one page (counterfactuals,
   behaviours, timeline, next steps). Show it all at once, or reveal the
   behaviours only after the member has read the counterfactual bars?
4. **Signed figures.** Arrow + sign + colour on every gain/loss. Keep the
   arrow everywhere, or drop it in dense tables and keep the sign?
5. **The preview banner** is sticky. Should the real header be sticky too?
6. **Calibration curve.** Is a five-bin reliability curve legible to a
   first-year, or does it need a one-line reading of "you are
   underconfident" beside it?
7. **Forecast input.** Slider (as built) versus a plain number field.
   Sliders invite round numbers; is that a problem?
8. **Thesis gate.** The 150-word counter turns green at the threshold. Is
   that the right nudge, or does it invite padding?
9. **Landing tone.** The "what we do not do" panel sits beside the hero.
   Prominent enough for the university, or too apologetic for applicants?
10. **Dark surfaces.** The banner and the primary buttons are the only
    dark or oxblood fills. Is that the right amount of brand?
