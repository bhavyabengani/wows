# Market data

Everything the simulation replays comes from a **pinned, versioned snapshot**
of end-of-day history, never from a live feed (H11). This file records where
that data came from, what was done to it, and what is known to be wrong with
it. Read it before trusting a number.

The pipeline that produces a snapshot is a standalone Python package in
`data/ingest/`. It is never imported by, bundled with, or merged into the
Next.js app (H37); the only thing passing between them is a directory of
files.

```
python -m wows_ingest fetch --date <today>   # network. writes data/raw/
python -m wows_ingest build --fetch-date <d> # offline. writes data/snapshots/v<N>/
python -m wows_ingest check --write-report   # offline. exits 1 on any failure
npm run db:load-snapshot -- v1               # loads a checked snapshot
```

## Why fetch and build are separate

Price sources revise history retroactively. `fetch` writes each response to
`data/raw/<source>/<fetch-date>/` and those files are **committed**; `build`
reads only committed files and never opens a socket. Someone in three years,
on a train, must be able to rebuild a byte-identical snapshot. A pipeline that
went back to the network during a build could not promise that, and the
determinism test in `data/ingest/tests/test_build.py` would not be able to
prove it.

## Sources

| What                          | Source                                         | Fetched     | Notes                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily bars, equities and ETFs | Yahoo Finance chart endpoint, `.NS` symbols    | 2026-09-09  | Called directly rather than through `yfinance`, which decodes prices into Python floats before our code sees them.                                             |
| Index history                 | Same endpoint, `^NSEI` and `^CRSLDX`           | 2026-09-09  | Nifty 50 and Nifty 500. Reference only; nothing is priced off them.                                                                                            |
| Cross-check                   | NSE end-of-day bhavcopy, sampled dates         | 2026-09-09  | Carries prices as they actually traded, with no retroactive adjustment. Only the current archive format is reachable, which limits samples to mid-2024 onward. |
| Deposit rates                 | RBI, 1-3 year term deposit rate of major banks | not fetched | **Unverified, see below.**                                                                                                                                     |

`curl_cffi` is used because the chart endpoint answers `429` to any client
that does not look like a browser at the TLS level. That is the same technique
`yfinance` uses internally; the difference is that we keep the response text,
so the digits in the committed file are the digits the source sent.

### Redistribution is unresolved

Whether the club may store and re-serve this data to anyone outside the
logged-in membership **has not been confirmed with the faculty advisor**.
Nothing built so far is public, so this blocks nothing today. It must be
settled before any price, chart or derived series appears on a public page.

## The universe, and why these instruments

Sixteen large-caps, three proxies, two indices, a synthetic deposit series and
cash. The full list with a one-line rationale each is in
`data/ingest/wows_ingest/config.py` and is reproduced into every snapshot as
`instruments.csv`.

**Corporate actions: restriction, not adjustment.** Rather than compute
adjustment factors and add a place for silent errors, the universe admits only
instruments with no split or bonus inside a replay window.

Admissibility is decided by the **split events** the source reports, not by
looking for jumps in the series. This matters more than it sounds: the source
retroactively adjusts historical prices, so a split leaves **no visible jump
at all**. Reliance's 1:1 bonus of 28 October 2024 is in the data with closes of
₹1,327.85 the day before and ₹1,334.35 the day after. A discontinuity check
alone would have passed a split-affected instrument and reported the universe
clean. The discontinuity check is kept, but as a second net.

The same test is run on the ETFs, which split too, and it is scoped to the
scenario window rather than to all of history: the snapshot deliberately
reaches back to 2007, and a legitimate 2013 split must not fail a build over a
2019-2023 universe.

Three names were proposed and **rejected by the events test**:

| Rejected | Event inside 2019-2023       |
| -------- | ---------------------------- |
| HDFCBANK | 2:1 split, 19 September 2019 |
| HCLTECH  | 2:1 split, 5 December 2019   |
| WIPRO    | 4:3 bonus, 6 March 2019      |

Nestlé India was proposed for exclusion as well but **passes**: its splits are
in 2024 and 2025, outside the window. It is left out of v1 only because the
sixteen admitted names already cover the sectors the first scenario needs;
adding it is a v2 decision, not a correction.

## Prices are adjusted to the fetch date

This is the most important caveat on this page.

The source's OHLC is adjusted for every split **up to the day it was fetched**,
including splits that happen _after_ the replay window. Reliance closed at
about ₹1,121 on 1 January 2019; this snapshot stores ₹512.48 for that day,
because of a 1:1 bonus in October 2024 and a rights issue in 2020.

What this does and does not affect:

- **Returns and portfolio values are correct.** Every series is internally
  consistent, so a member who buys and holds gets the right answer.
- **Absolute price levels are not the levels a student would have seen.** A
  member who looks up "Reliance in January 2019" will find ₹1,121 and see
  ₹512.48 on the portal. For a club whose credibility rests on numbers being
  right, that is worth stating in the interface when prices are first shown.
- **It is frozen.** Because the raw files are committed and `build` never
  refetches, this snapshot will not silently change the day Reliance splits
  again. A refetch would produce different numbers for the same dates, which
  is precisely why refetching is not part of a build.

Un-adjusting is possible: it is one multiplication per instrument by the
cumulative ratio of splits after the window. It was **not** done, because it is
an adjustment, and the club chose restriction over adjustment. If the level
matters more than that principle, it belongs in v2 as a deliberate decision.

Rights issues are a related gap: the source adjusts for them but does **not**
report them as events, so neither the events test nor the discontinuity check
can see one. Reliance had a rights issue in 2020, inside the window. There is
no automated defence against this today; the honest options are a manual
corporate-actions cross-check against NSE announcements, or accepting it and
saying so. This is said here.

## The trading calendar is derived, not transcribed

A date is a trading day if **a quorum of instruments have a bar on it** (at
least half). The gap check then reads "every instrument has a bar on every
date the market was open", which is self-consistent and reproducible offline.

Twenty years of NSE holiday circulars typed by hand would be about three
hundred rows of transcription with no way to prove it is right, and it would
rot as soon as the person who typed it graduates.

The first design took the calendar as the dates on which the **Nifty 50**
series has a bar. That was abandoned on evidence: the fetched index has no bar
on 2013-01-01, 2014-01-01 or 2015-01-01, among roughly twenty other dates when
the rest of the market plainly traded. Taking those as holidays would have
declared every real bar on them an error. A quorum cannot be broken by one
series with holes.

Two sanity checks guard it, because a derived calendar is only as good as the
files behind it: no more than four consecutive weekdays without trading, and
240 to 255 trading days in a full year. Weekend dates are excluded outright,
which means the occasional Diwali _muhurat_ session on a Saturday or Sunday is
dropped; those exclusions are listed in `excluded-rows.csv`.

Holiday circulars remain a reasonable manual cross-check if anyone wants one.
They are not needed to build or to check a snapshot.

## Money

All prices are **integer paise** (H12). Source text is parsed to `Decimal`
(`json.loads(..., parse_float=Decimal)`), arithmetic stays in `Decimal`, and
the single conversion to `int` happens in `wows_ingest/money.py`. A Python
`float` is refused rather than coerced: by the time a price is a float the
damage is done and cannot be detected downstream.

Rounding is **half away from zero**, per `docs/ENGINE_RULES.md`. The Phase 2
brief suggested `ROUND_HALF_EVEN` in passing; `ENGINE_RULES.md` was written in
Phase 1 and is the authority, so that parenthetical is superseded and should
not be reopened. Python's `ROUND_HALF_UP` implements "ties away from zero"
despite its name.

Volume is a whole number of units. The deposit series has no volume and stores
`0`, not null.

## Proxies

| Role             | Instrument                                    | Why                                                                                                                 |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Large-cap index  | `^NSEI` (reference), `NIFTYBEES` (investable) | The index itself cannot be bought, so the ETF is what a member actually holds.                                      |
| Broad market     | `^CRSLDX`                                     | Nifty 500, for breadth comparisons. Reference only.                                                                 |
| Gold             | `GOLDBEES`                                    | Rupee-denominated and NSE-traded, so no exchange-rate assumption enters the game.                                   |
| Government bonds | `LTGILTBEES`                                  | Investable gilt exposure. History starts 2018-05-11, which covers 2019-2023 but **rules out a 2007-2011 scenario**. |
| Fixed deposit    | `FD1Y`                                        | Synthetic. See below.                                                                                               |
| Cash             | `CASH`                                        | Holds value, earns nothing, has no bars.                                                                            |

`LTGILTBEES` is thinly traded: it has **no trade on 131 of the 1,233 trading
days** in the 2019-2023 window, about one day in ten. That absence is real, not
a fetch failure, and no bar is invented for it. It is recorded in
`policy.json` with a tolerance just above the observed rate, so a series that
quietly gets worse still fails the check. **How a holding is marked on a day
with no trade is an engine rule owed by Phase 3** (carry the last close).

## The fixed-deposit series

`FD1Y` is a **rolling reinvestment index**, base 100, that earns the prevailing
1-3 year term deposit rate and re-rates whenever a new rate is published.
Interest accrues on a 365-day year and compounds at calendar quarter ends. It
is not a traded price and there is no market in it; open, high, low and close
are all the same value and volume is zero.

It **cannot** express "the rate is fixed at the deposit date for the tenure",
because the deposit date differs per member and per run while this file is one
series shared by everyone. **Lock-in, the rate prevailing at a member's own
deposit date, and the premature-withdrawal penalty are engine rules owed by
Phase 3**, applied on top of this series. That penalty is the actual
educational content of a deposit versus equity, so it must not be lost by
living nowhere; it is recorded here and in `docs/ENGINE_RULES.md`.

RBI publishes the rate as a range. The convention is the **midpoint**, applied
once, in `wows_ingest/fd.py`. A row the parser cannot interpret raises rather
than silently taking the first number, and there are tests for `"6.25-"` and
`"-4"` because both used to slip through as a single value.

### The rate series is unverified

`rbi.org.in` answered `403` to every automated request made while this snapshot
was built, and the RBI data portal serves its figures only through a
JavaScript application. The rows in
`data/raw/rbi/2026-09-09/term-deposit-rates-1-3y.csv` were **entered by hand as
an approximation** so that the pipeline, the model and the tests are complete
and exercisable. They are not authoritative.

The manifest records `fd_series_verified: false`, the check report repeats the
warning, and `npm run db:load-snapshot` prints it on every load, so nothing
downstream can quietly assume otherwise. Before any real season uses the fixed
deposit: download the RBI table, replace that file wholesale keeping the same
three columns, and build a **new snapshot version**.

## Known source defects

Recorded in `data/snapshots/v1/policy.json`, each with a reason, and removed
from the snapshot rather than corrected. A removed row leaves a documented gap;
an invented price would leave nothing at all.

| Instrument  | Dates                  | What is wrong                                                                                                                                               |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOLDBEES`  | 2019-12-19, 2019-12-20 | Both days at one hundredth of the true scale (₹0.30 against ₹33.60 the day before and ₹33.65 the day after), with volume inflated by about the same factor. |
| `NIFTYBEES` | 2019-12-19, 2019-12-20 | The same defect on the same days at one tenth of scale (₹13.02 against ₹129.25 and ₹129.93).                                                                |

Requesting those two days on their own returns the same values, so the error is
in the source's stored history and cannot be fetched around. No split or bonus
is reported anywhere near the date. They were found by the discontinuity check,
which is the whole reason it is kept as a second net.

`GOLDBEES` also has a zero opening price on every day of its first year
(2009-01-02 to 2010-01-18, 247 rows). Those rows are structurally invalid and
are removed automatically, with the reason recorded in `excluded-rows.csv`.
They are outside every scenario window.

## What a snapshot contains

```
data/snapshots/v1/
  instruments.csv        symbol, name, asset class, role, rationale
  bars.csv               symbol, trade_date, o/h/l/c in paise, volume
  calendar.csv           the derived trading days
  corporate-actions.csv  every split or bonus found, and whether it is in window
  excluded-rows.csv      every row removed, and why
  policy.json            hand-maintained: band, exceptions, defects, tolerances
  manifest.json          checksums, row counts, date ranges, the policy applied
  check-report.txt       the output of `check`, committed
```

`manifest.json` is how CI proves nobody edited a snapshot by hand: it records
the SHA-256 of every file, and both `check` and the loader refuse a snapshot
whose files no longer match. `built_at` is the only field that changes between
two builds of the same raw files.

`policy.json` is the one file a human is expected to edit. The first build of a
new version produces something the checks reject; the report names every
offending row, and a maintainer writes down a reason for each before it can
pass. That is deliberate: **no snapshot becomes clean until a person has
explained it.**

## Producing v2 when something needs correcting

`price_bars` are immutable (H7). A correction is never an edit.

1. Fetch again if the source has changed: `fetch --date <today>`. Commit the
   new raw files alongside the old ones; nothing is deleted.
2. Bump `SNAPSHOT_VERSION` in `data/ingest/wows_ingest/config.py`, and add the
   new scenario window there if that is what changed.
3. `build --fetch-date <date> --version 2`.
4. `check --version 2 --write-report`. It will fail. Read the report, add a
   reason for each finding to `data/snapshots/v2/policy.json`, rebuild, and
   repeat until it is clean.
5. Commit `data/snapshots/v2/` including the check report.
6. `npm run db:load-snapshot -- v2`. It loads alongside v1; it does not replace
   it. Which version a scenario uses is pinned by the scenario (H6).

Never edit a committed snapshot, and never load a version twice: the loader
refuses both, and the checks catch it if the loader is bypassed.
