# Preview feedback

One numbered entry per screen, in the order the preview index lists them.
Write under the screen you are talking about, initial your note, and leave
everything else alone — the point of this file is that the club's review comes
back as one document rather than forty messages.

**How to review.** Open [`/preview`](../src/app/preview/page.tsx) on the
deployed preview and click through in order. Every figure is invented; do not
report that a number is wrong. Report that a number is in the wrong place, is
the wrong size, is unreadable, or should not be on the screen at all.

Three questions are worth asking on every screen:

1. What is this screen for, in one sentence? If you cannot say, write that.
2. What is the first thing your eye lands on, and should it be?
3. What would you do next, and can you?

The general design questions — density, mobile tables, the masthead, the type
pairing — are at the end of [`DESIGN_PREVIEW.md`](DESIGN_PREVIEW.md) and
answers to those go here too, at the bottom.

---

## Public

### 1. `/` — Landing

### 2. `/about` — About the club

### 3. `/apply` — Application form

### 4. `/apply` after submitting — the applicant's view

### 5. `/research` — Published note archive

### 6. `/research/[slug]` — A published note

---

## Member

### 7. `/dashboard` — Member dashboard

### 8. `/dashboard?state=loading` — Loading

### 9. `/dashboard?state=empty` — A member's first day

### 10. `/dashboard?state=error` — A failed load

### 11. `/play/allocate` — The allocation game

### 12. `/play/allocate/debrief` — The debrief

### 13. `/play/portfolio` — Season portfolio, open positions

### 14. `/play/portfolio` — Opening a position, and the thesis gate

### 15. `/play/portfolio` — A closed position against its falsifier

### 16. `/play/forecast` — Forecast questions

### 17. `/play/forecast` — The reliability curve

### 18. `/play/quiz` — The quiz

### 19. `/play/quiz/kiosk` — Kiosk mode

### 20. `/leaderboard` — Leaderboards

### 21. `/research/submit` — Submitting a note

### 22. `/research/mine` — My research

### 23. `/learn` — Curriculum tracks

### 24. `/learn/[slug]` — A curriculum module

### 25. `/events` — Events

### 26. `/members` — Member directory

### 27. `/me` — My profile

---

## Admin

### 28. `/admin/members` — Roster and applicants

### 29. `/admin/seasons` — Seasons and settlement

### 30. `/admin/games` — Scenarios and instances

### 31. `/admin/content` — Questions, curriculum, quiz banks, news cards

### 32. `/admin/review` — Research review queue

### 33. `/admin/audit` — Audit log

---

## The sparse states

The club's first month, which is the normal case rather than the edge case.
The question for each is not "does it look sad" but "does it look broken, and
would a first-year think the site was failing".

### 34. `/leaderboard?state=sparse` — six names

### 35. `/members?state=sparse` — six members

### 36. `/me?state=sparse` — four resolved forecasts, below the threshold

### 37. `/research?state=sparse` — one published note

### 38. `/events?state=sparse` — one event, three RSVPs

---

## Across the whole product

Eleven contradictions between screens are listed at
[`DESIGN_PREVIEW.md` › What looks wrong once you have seen every screen at
once](DESIGN_PREVIEW.md). Each needs a decision, not a note.

### 39. `/dashboard` and `/me` show the same thing

### 40. The leaderboard does not link to a person

### 41. Positions and research notes never reference each other

### 42. Only the latest run has a debrief

### 43. The quiz does not know which module it belongs to

### 44. Applicants have no route to return to

### 45. Two review queues doing the same job

### 46. Events have no detail page

### 47. Sparse data wants a different screen, not a thinner one

### 48. No screen says what to do next

---

## Answers to the general design questions

The ten questions at the end of [`DESIGN_PREVIEW.md`](DESIGN_PREVIEW.md):
density, mobile leaderboard, the debrief's disclosure, signed figures, the
oxblood masthead, the calibration curve, the forecast input, the thesis gate,
the landing tone, and the type pairing.

### 49. Density

### 50. Leaderboard on mobile

### 51. Debrief: all at once, or revealed

### 52. Signed figures: keep the arrow everywhere

### 53. The oxblood masthead

### 54. The calibration curve

### 55. The forecast input

### 56. The thesis gate

### 57. Landing tone

### 58. Type: Schibsted Grotesk and IBM Plex Mono
