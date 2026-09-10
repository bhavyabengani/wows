# Design preview

Branch `design-preview`. **Throwaway.** It exists so the club can react to the
look, the density and the flows of the whole product before committing to the
remaining build. Later phases may borrow layout and components from it, but
this branch is **not the implementation and is not to be merged to `main`.**

Start at [`/preview`](../src/app/preview/page.tsx): every screen in the
product, in one list, linked. The preview banner links it from every page.

## It is now rebased onto `main`, and that broke things worth knowing about

Passes 1 and 2 branched from the last Phase 0 commit, because `main` already
had Phase 1's auth and a login test that a static `/dashboard` could not
satisfy. Pass 3 rebases onto current `main`, which carries Phase 2 (the
snapshot), Phase 3 (the engine) and Phase 4 (the real allocation game). Three
collisions had to be resolved, and each was resolved in favour of the preview,
because a review artefact that needs a database is not a review artefact:

1. **Duplicate routes.** `main` has the real `/dashboard`, `/play/allocate`
   and `/play/allocate/debrief` under the `(member)` route group; the preview
   has static versions at the bare paths. Two pages cannot resolve to one URL,
   so `src/app/(member)` is deleted **on this branch only**.
2. **The auth proxy gated everything.** `src/proxy.ts` sends signed-out
   visitors of `/dashboard`, `/play`, `/leaderboard`, `/research/submit`,
   `/research/mine`, `/learn`, `/events`, `/members`, `/me` and `/admin` to
   `/login` — which is to say, the entire product. `isProtectedPath` returns
   `false` on this branch, with `PROTECTED_PREFIXES` left in place above it so
   a rebase back shows exactly what was disabled.
3. **Two end-to-end specs test the real app.** `e2e/login.spec.ts` and
   `e2e/allocate.spec.ts` need Supabase, a seeded database and the `(member)`
   routes. Both are deleted here. They are untouched on `main`.

**The smoke test was passing against the login page.** Every route asserted a
banner, a footer and an `h1` — and `/login` has all three, so thirty-five
redirects to sign-in read as thirty-five rendering screens. The spec now
asserts where it actually landed. That fix is worth keeping when this branch
is thrown away.

## Pass 2: what changed

The team's reaction to pass 1 was "default admin template". Pass 2 follows
[`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md): a broadsheet financial page
on paper, with numbers as the subject. Before/after screenshots of the
dashboard, leaderboard and allocation page are in `docs/screenshots/`.

- **Type.** Schibsted Grotesk for interface and headlines, IBM Plex Mono for
  every number (see `DEPENDENCIES.md`). Four sizes: 40px display (32 on
  phones), 20px section, 15px body, 12.5px caption. The `numeric` utility
  now switches to the mono face as well as tabular figures.
- **Colour and surface.** The header is an oxblood masthead. Oxblood also
  fills the one primary button per screen, the selected leaderboard tab, the
  current timestep tick, and a forecast's recorded and locked states. No
  drop shadows anywhere; rules and space separate content. The leaderboard
  has no card; secondary notes get a rule; callouts get an oxblood left rule.
- **Sparklines** on the dashboard (overall index and every track), every
  leaderboard row, every portfolio position, and the allocation cockpit
  (corpus by step). Hand-written SVG, ink-coloured, no axes.
- **Leaderboard** as a full-width table: rank in the mono face, your row
  tinted oxblood at 6%, the components drawer inset on the same paper with a
  short slide, two-line rows on phones instead of horizontal scroll.
- **Allocation cockpit.** Replay date and portfolio value in display size
  top-left, a single stacked bar segmented by class (oxblood, greens, greys,
  hatching for the FD so it reads without colour), sliders beneath, the news
  set apart by an oxblood rule, and Advance as the only filled button. On
  advance the value counts to its new figure over 400ms and the timestep
  tick moves.
- **Landing** as a typographic opening statement, the four functions as a
  two-column list with specimen numbers from the sample data, and the
  faculty and no-advice policy as a ruled masthead block.
- **Forecasts.** Submit settles the input into a filled-oxblood recorded
  block with the probability at display size; locked questions are oxblood
  panels. The reliability curve keeps its dotted diagonal and count-sized
  points, with the Brier score set large beside it.
- **Debrief** as a document: three large numbers in a row, behaviours as
  paragraphs led by an oxblood keyword, the timeline as a vertical rule with
  events pinned to it.
- **Mobile.** Bottom navigation replaces the drawer; tables reflow to two
  lines; the allocation breakdown stacks.
- **Motion.** Exactly three moments: count-up on advance, the forecast
  record, the leaderboard drawer. Reduced motion disables all of them; the
  loading state is a plain "Loading standings…" line.

## Pass 3: the rest of the product

Every route in the site map is now reachable by clicking. New in this pass:

| Route              | What it shows                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `/about`           | The club, three verticals with leads and headcount, faculty oversight, and the four things it has committed in writing not to do. |
| `/apply`           | The application form with word gates; submitting shows the applicant's own view of the four review states.                        |
| `/play/quiz`       | A question, immediate feedback with the reasoning, and a summary against the club median. Explicitly not scored.                  |
| `/play/quiz/kiosk` | Kiosk mode: an oxblood field, name entry, three questions, a score and a stall board. States that it touches no member account.   |
| `/research/submit` | The submission form, with the falsifier as a gate rather than a field, and the rubric beside it while you write.                  |
| `/research/mine`   | The author's own notes across draft, submitted, in review, changes requested and published, with reviewer comments on one.        |
| `/members`         | The directory by vertical: name, cohort, role, published count. Deliberately no performance figures.                              |
| `/me`              | Standing per track, curriculum progress, the full forecast history with Brier scores, published notes, attendance.                |
| `/play/portfolio`  | Extended with closed positions: the outcome set directly beside the falsifier its author wrote before the fact.                   |
| `/admin/members`   | Roster, roles, verticals, promote controls, and applicant review with a two-reader rule.                                          |
| `/admin/seasons`   | The state machine, all four seasons, and what settling warns about — blocked while two questions are unresolved.                  |
| `/admin/games`     | Scenarios, versions, instances, run counts, and the ranked-attempt rule stated where an admin will read it.                       |
| `/admin/content`   | Forecast questions, curriculum, quiz banks and news cards, each with a state; includes a voided question and a rejected one.      |
| `/admin/review`    | The research queue in three stages, the rubric, the faculty gate, and lint flags that a human still reads.                        |
| `/preview`         | The index of every screen, linked, so a reviewer never guesses a URL.                                                             |

Navigation: `Members` is not in the primary bar — the account menu carries
the profile, portfolio, own research, quiz, kiosk and directory, plus About
and Apply, plus the preview index. `Admin` sits in the masthead and every
admin page carries a second-level nav.

### The sparse states

The club's first month is the normal case, not the edge case, so five screens
have a `?state=sparse` variant: `/leaderboard` (six names), `/members` (six
members), `/me` (four resolved forecasts, below the threshold and told so),
`/research` (one note) and `/events` (one event, three RSVPs). They are linked
from the preview index.

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

## What looks wrong once you have seen every screen at once

Nobody had seen the whole product in one sitting before this pass. These are
contradictions between screens rather than problems with any one of them, so
none of them would surface in a phase that builds a module at a time.

1. **`/dashboard` and `/me` are the same screen twice.** Both open with
   standing across tracks. One of them has to be the answer to "how am I
   doing" and the other has to be something else, or members will learn to
   check both.
2. **The leaderboard is a dead end.** Fifteen names, none of them clickable.
   There is no public member page at all — `/me` is the only profile, and it
   is yours. Either names link somewhere or the directory absorbs the job.
3. **A closed position and a research note about the same company never
   meet.** The most interesting question a debrief raises — "what did I write
   about this at the time?" — has no link to follow in either direction.
4. **Only the most recent completed run has a debrief.** `/play/allocate/debrief`
   shows the latest one and there is no list of past runs, so a member's first
   attempt becomes unreachable the moment they finish a second.
5. **`/play/quiz` has no idea which module it belongs to.** A quiz is part of a
   curriculum module, but the route stands alone, so a member can land on it
   with no context and no way back to the thing it was testing.
6. **Applicants have nowhere to return to.** `/apply` submits and shows the
   review states, but there is no route an applicant can come back to next
   week. `/me` assumes membership, and the site map has no applicant home.
7. **Two review queues that are the same job.** Forecast questions wait in
   `/admin/content` and research notes wait in `/admin/review`. Both are
   "member-authored things awaiting a state change", and a reviewer has to
   already know which queue a thing is in to find it.
8. **`/events` has no detail route.** An event has a description, a location
   and an attendee list, and nowhere to put them. RSVP is the only thing you
   can do to one.
9. **Sparse data does not just look thinner, it wants a different screen.** Six
   people is a list, not a ranked table. Four resolved forecasts is not a
   reliability curve, and drawing one implies a confidence the data cannot
   support. The `?state=sparse` variants make this visible rather than fixing
   it.
10. **Nothing on any screen says what to do next.** Every page reports state
    accurately and none of them tells a member what they owe the club this
    week. That is the difference between a portal people open twice a week and
    one they open when reminded.
11. **Kiosk mode cannot be what it needs to be inside this shell.** It should
    replace the chrome entirely on a borrowed laptop at a stall; in the
    preview it cannot, because the banner and footer must appear on every
    route. Judge its _content_, not its containment.

## Design questions for the team

1. **Density.** The leaderboard is set at 15px with 12px of vertical padding
   per row. Too airy for a data product, or right for a phone?
2. **Leaderboard on mobile.** Table with horizontal scroll (as built) or
   stacked cards per member? Cards read better; tables compare better.
3. **Debrief.** Currently everything is on one page (counterfactuals,
   behaviours, timeline, next steps). Show it all at once, or reveal the
   behaviours only after the member has read the counterfactual bars?
4. **Signed figures.** Arrow + sign + colour on every gain/loss. Keep the
   arrow everywhere, or drop it in dense tables and keep the sign?
5. **The oxblood masthead.** Enough brand, or does the header want to be
   paper with an oxblood rule instead?
6. **Calibration curve.** Is a five-bin reliability curve legible to a
   first-year, or does it need a one-line reading of "you are
   underconfident" beside it?
7. **Forecast input.** Slider (as built) versus a plain number field.
   Sliders invite round numbers; is that a problem? And is the filled-oxblood
   "Recorded" block the right weight for a revisable answer?
8. **Thesis gate.** The 150-word counter turns green at the threshold. Is
   that the right nudge, or does it invite padding?
9. **Landing tone.** The "what we do not do" panel sits beside the hero.
   Prominent enough for the university, or too apologetic for applicants?
10. **Type.** Schibsted Grotesk and Plex Mono: does the pairing feel like
    the club, and is Plex Mono legible enough at 12.5px for dates in tables?
