# Scenarios

One directory per scenario name, one per version inside it. A scenario is a
named, seeded, versioned config (H6): `(name, version)` is unique, and a
config is **never edited in place**, because a leaderboard is pinned to the
version that produced it. Changing anything here means writing `v2`.

```
first-replay/v1/config.json   the scenario itself
first-replay/v1/news.json     the cards, versioned alongside it
```

`news.json` is separate so a content change is visible as a content change,
but it is still part of the version: adding a card means a new scenario
version, not an edit to this one.

## Writing a news card

Each card is `{ step, dateline, headline, body, source }`.

**Every card must be written from information available on or before its step
date.** A card composed in 2026 that says a crash "would go on to" recover
leaks the future in prose. `[HARD] H15` stops the client receiving future
_data_ and has no opinion about sentences, so this is a review rule, and it is
on the review checklist alongside faculty approval:

1. Does every claim hold as of the card's own date?
2. Is there any hint of what happens next, including in tone?
3. Is the source real, and named?
4. Does it avoid anything that reads as a recommendation?

The engine runs with no cards at all, so the scenario is playable and testable
before the content exists. A step with no card is normal, not missing.
