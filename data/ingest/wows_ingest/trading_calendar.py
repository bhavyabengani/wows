"""
The NSE trading calendar, derived rather than transcribed.

Twenty years of holiday circulars typed by hand is ~300 rows of transcription
with no way to prove it is right, and it rots the moment nobody remembers
where it came from. So the calendar is *derived*: a date is a trading day if a
quorum of the instruments in the snapshot have a bar on it. The gap check then
reads "every instrument has a bar on every date the market was open", which is
self-consistent and reproducible offline from the committed raw files.

**Why a quorum rather than the Nifty 50 series alone.** That was the original
design, and it is one bad series away from being wrong: the fetched index has
no bar on 2013-01-01, 2014-01-01 or 2015-01-01, among about twenty other dates
on which the rest of the market plainly traded. Taking those as holidays would
have declared every real bar on them an error. A quorum cannot be broken by a
single series with holes, and it keeps every other property that mattered:
derived, not transcribed; reproducible offline; no external calendar file.

Two sanity checks guard the result. They catch a truncated or partially
fetched set of raw files, which is the realistic failure, rather than trying
to re-derive the holiday list.
"""

from __future__ import annotations

import datetime as dt

MAX_CONSECUTIVE_WEEKDAY_GAP = 4
MIN_QUORUM = 2
MIN_TRADING_DAYS_PER_YEAR = 240
MAX_TRADING_DAYS_PER_YEAR = 255


class CalendarError(ValueError):
    pass


def quorum_size(instrument_count: int) -> int:
    """A date is a trading day if at least this many instruments have a bar."""
    return max(MIN_QUORUM, instrument_count // 2)


def derive(bars_by_symbol: dict[str, set[dt.date]]) -> list[dt.date]:
    """
    Dates on which a quorum of instruments traded, in order.

    Weekend dates are excluded outright: NSE does hold the occasional Saturday
    session, but a weekend date reaching quorum in a daily series is far more
    likely to be a source error, and admitting one would weaken every check
    built on this calendar.
    """
    tally: dict[dt.date, int] = {}
    for days in bars_by_symbol.values():
        for day in days:
            tally[day] = tally.get(day, 0) + 1
    needed = quorum_size(len(bars_by_symbol))
    return sorted(d for d, n in tally.items() if n >= needed and d.weekday() < 5)


def sanity_check(days: list[dt.date], full_years: list[int]) -> list[str]:
    """
    Returns a list of problems; empty means the calendar looks like an NSE
    calendar. `full_years` are the years the snapshot claims to cover end to
    end, so a partial first or last year is not counted against it.
    """
    problems: list[str] = []
    if not days:
        return ["calendar is empty"]

    trading = set(days)
    run_start: dt.date | None = None
    run = 0
    cursor = days[0]
    last = days[-1]
    while cursor <= last:
        if cursor.weekday() < 5 and cursor not in trading:
            run += 1
            if run_start is None:
                run_start = cursor
            if run == MAX_CONSECUTIVE_WEEKDAY_GAP + 1:
                problems.append(
                    f"more than {MAX_CONSECUTIVE_WEEKDAY_GAP} consecutive weekdays with no "
                    f"trading from {run_start}; the index series is probably incomplete"
                )
        else:
            run = 0
            run_start = None
        cursor += dt.timedelta(days=1)

    for year in sorted(full_years):
        count = sum(1 for d in days if d.year == year)
        if not (MIN_TRADING_DAYS_PER_YEAR <= count <= MAX_TRADING_DAYS_PER_YEAR):
            problems.append(
                f"{year} has {count} trading days, outside "
                f"{MIN_TRADING_DAYS_PER_YEAR}-{MAX_TRADING_DAYS_PER_YEAR}"
            )
    return problems
