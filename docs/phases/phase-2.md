# Phase 2 — Market data pipeline

Session date: 9 September 2026. Brief: `phase-2-market-data.md` (Phase 2 of
12), on a `phase-2` branch cut from `main`.

## What was built

- **A standalone Python pipeline** in `data/ingest/`, with its own pinned
  `requirements.txt` and its own CI job. Three commands: `fetch` (the only
  networked step), `build` (offline, deterministic), `check` (offline, exits
  non-zero on any failure). Nothing in the Next.js app imports it (H37).
- **Snapshot v1**, committed: 23 instruments and 102,152 daily bars from
  2007-01-02 to 2026-08-28, with a derived trading calendar, every corporate
  action found, every row excluded and why, a hand-maintained policy file, a
  manifest of checksums, and the check report.
- **Raw source files**, committed (9.6 MB): one JSON response per instrument
  plus three NSE bhavcopy samples. `build` reads only these and never opens a
  socket, so the snapshot rebuilds byte-identically with no network.
- **Nineteen quality checks**, run before a snapshot may be committed and
  again by the loader. Every failure names the offending symbols and dates.
- **A TypeScript loader**, `npm run db:load-snapshot -- v1`, that loads
  instruments and bars in one transaction and refuses a version already
  present or a snapshot whose files no longer match their checksums.
- **A migration** adding `fixed_deposit` to the `asset_class` enum.
- **Tests**: 72 pytest, 22 Vitest unit, 28 database (6 new for the loader).

## Decisions taken from the review

Drizzle-owned migrations, the 2019-2023 first window, a 2007-2026 fetch,
restriction over adjustment, raw files committed directly, and a TypeScript
loader, all as proposed. Plus, from the review itself:

- **Split events are the authoritative admissibility test**, not the
  discontinuity check. This turned out to matter more than expected: see the
  finding below. The events test is run on the ETF proxies too, and both it
  and the discontinuity check are scoped to the scenario window.
- **`json.loads(..., parse_float=Decimal)`**, asserted by a test that also
  fails if any module calls `json.loads` directly or uses `float()`.
- **The fixed deposit is a rolling reinvestment index**, and lock-in and the
  premature-withdrawal penalty are recorded in `docs/ENGINE_RULES.md` as owed
  by Phase 3 rather than being lost.
- **RBI ranges take the midpoint**, and the parser raises on anything it
  cannot read.
- **The calendar is derived, not transcribed.**
- **`ROUND_HALF_EVEN` in the brief is superseded** by `ENGINE_RULES.md`,
  recorded in `docs/DATA.md` so it is not reopened.

## Findings that changed the work

**All sixteen curated names survived the events test.** The three proposed
exclusions were right: HDFCBANK (2:1, September 2019), HCLTECH (2:1, December 2019) and WIPRO (4:3, March 2019) all have an event inside the window.
NESTLEIND, which was also proposed for exclusion, actually passes: its splits
are in 2024 and 2025. It is left out of v1 anyway because the sixteen cover
the sectors the first scenario needs; adding it is a v2 decision.

**Prices are adjusted to the fetch date, not to the window.** The source
adjusts history for splits that happen _after_ the replay window too. Reliance
closed near ₹1,121 on 1 January 2019; the snapshot stores ₹512.48, because of
a 1:1 bonus in October 2024 and a rights issue in 2020. Returns are correct
and the snapshot is frozen, but the absolute levels are not what a student
would find if they looked the day up. Un-adjusting was **not** done, because
it is an adjustment and the club chose restriction. This needs a decision
before prices are shown in the interface; it is written up in `docs/DATA.md`.

**Rights issues are invisible to both nets.** The source adjusts for them but
does not report them as events, so neither the events test nor the
discontinuity check can see one. Reliance had a rights issue in 2020, inside
the window. There is no automated defence today.

**The discontinuity check found a real defect.** GOLDBEES and NIFTYBEES both
have two days, 19 and 20 December 2019, at one hundredth and one tenth of true
scale respectively, with volume inflated by the same factor. Requesting those
days alone returns the same values, so it is wrong in the source's stored
history. The rows are removed with a recorded reason rather than rescaled.
GOLDBEES also has a zero opening price for its whole first year, outside every
window; those 247 rows are removed automatically.

**The Nifty 50 series has holes.** It has no bar on 2013-01-01, 2014-01-01 or
2015-01-01 among about twenty other dates the market plainly traded, so
defining the calendar as "dates the Nifty 50 traded" would have declared every
real bar on those dates an error. The calendar is instead the set of dates a
**quorum** of instruments traded. Same properties, one fewer single point of
failure. Recorded as a deviation below.

**Two parser bugs, caught by the tests the review asked for.** `"6.25-"` and
`"-4"` both used to yield a single number, which is exactly the silent
first-number-wins behaviour the brief warned about.

## Deviations from the brief

1. **The calendar is a quorum, not the Nifty 50 alone**, on the evidence
   above. Everything else about it is as directed: derived, offline,
   reproducible, guarded by the two sanity checks.
2. **`yfinance` is not the client.** It decodes prices into floats before our
   code sees them. The pipeline calls the same chart endpoint directly and
   keeps the response text, using `curl_cffi` for the browser TLS fingerprint
   the endpoint requires. `yfinance` is not a dependency at all.
3. **The bhavcopy cross-check is thin.** Only the current archive format is
   reachable; the pre-2024 URL format times out, so samples are from mid-2024
   onward and cannot cross-check a 2019 price. Three files are committed.
4. **The gap check fails only inside a scenario window.** Out-of-window gaps
   are counted and reported, not fatal, for the same reason the review gave
   for scoping the discontinuity check.
5. **The seed's placeholder scenario** now uses a real universe and the real
   2019-2023 window, but `config_json` is still a placeholder, as instructed.

## Not done, and why

- **The RBI deposit-rate series is unverified.** `rbi.org.in` answered 403 to
  every automated request, and the data portal serves figures only through a
  JavaScript application. The committed rate file was entered by hand as an
  approximation so the model and its tests are exercisable. It is marked
  `fd_series_verified: false` in the manifest, repeated in the check report,
  and printed by the loader on every load. **It must be replaced from the RBI
  source, as a new snapshot version, before any real season uses the fixed
  deposit.**
- **No engine, valuation or order logic**, per the brief.
- **A 2007-2011 scenario is not possible with v1**: the gilt proxy's history
  starts in 2018.

## `[HARD]` invariants updated

| Invariant | Now tested by                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H7        | `src/db/snapshot.db.test.ts` plus the Phase 1 database triggers.                                                                                                         |
| H11       | `src/lib/repo-invariants.test.ts` (nothing under `src/` or `scripts/` can reach a price source) and `data/ingest/tests/test_build.py` (offline, byte-identical rebuild). |
| H12       | `data/ingest/tests/test_money.py`, `test_no_float.py`, and the loader test that prices arrive as `bigint`.                                                               |
| H37       | Extended: no import from `data/ingest` in app code, and a separate CI job.                                                                                               |

## Verification

- `db:reset && db:seed && db:load-snapshot -- v1` from clean: 23 instruments,
  102,152 bars, with the unverified-deposit warning printed.
- `check` on v1: 19 passed, 0 failed. Report committed.
- Building twice from the committed raw files produces identical checksums for
  every data file.
- Locally green: typecheck, lint, format, 22 unit, 72 pytest, 28 database.

## Follow-ups completed after review (9 September 2026)

- **Adjusted levels are kept, and un-adjusting is rejected for good**, because
  it would need a complete corporate-action history and the source does not
  report rights issues. The reasoning is recorded in `docs/DATA.md` so it is
  not reopened. The cost is paid as display honesty instead: the manifest now
  carries `is_adjusted`, `adjusted_as_of`, `price_basis` and
  `dividends_included`, a new `snapshots` table carries them into the database,
  and the loader prints them.
- **Dividends: checked, and the answer is clean.** The stored series is
  price-return for every instrument, so the counterfactual comparison is
  apples to apples. The equity `close` differs from its dividend-adjusted
  counterpart across nearly all history, while the ETFs and the index are
  byte-identical to theirs. Two consequences are written up: the game
  understates equity returns by roughly the dividend yield, and switching to
  the adjusted close would put the close below the low and fail our own OHLC
  check.
- **Missing bars have a policy**, recorded in `docs/ENGINE_RULES.md`: carry the
  previous close forward and mark the valuation as having used a synthetic bar,
  with the date of the close actually used. It applies to every missing bar,
  whatever the cause, so a future recorded defect needs no new rule.
- **The fixed deposit is out of the v1 scenario's playable universe** until its
  series is verified. A printed warning is invisible six months later; an
  absent instrument is not. `docs/DATA.md` now specifies exactly which RBI
  table to download and the file format to drop it into.
- **The formatter rule is generalised** in `CLAUDE.md`: anything whose checksum
  is in a manifest is off limits to every formatter, linter and code
  generator, and a new tool must be given those ignore paths in the same
  commit.
- **The calendar evidence is hardened** in `docs/DATA.md` with a note saying
  not to revert it, because the holes fall on 1 January and look like holidays.

## Open questions for Phase 3

1. **Rights issues.** Accept that neither net catches them, or add a manual
   corporate-actions cross-check against NSE announcements? Settled for
   adjustment purposes, since un-adjusting is rejected; still open as a data
   quality question.
2. **The gilt proxy.** `LTGILTBEES` has no trade on about one day in ten and
   no history before 2018. Keep it and let the engine carry the last close, or
   find a better instrument before scenarios need one?
3. **Nifty 500 and the deposit index are reference-only series.** Should
   members be able to hold them, or are they display-only?
4. **Ownership** of GitHub, Vercel, Supabase and the domain: still unrecorded,
   carried from Phase 0.
