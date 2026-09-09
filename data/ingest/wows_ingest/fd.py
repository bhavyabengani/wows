"""
The fixed-deposit series.

**What this is.** A rolling reinvestment index, base 100, that earns the
prevailing 1-3 year term-deposit rate and re-rates whenever a new rate is
published. It is not a traded price and there is no market in it.

**What it deliberately is not.** It cannot express "the rate is fixed at the
deposit date for the tenure", because the deposit date differs per player and
per run, and this file is one series shared by everyone. Lock-in, the rate
prevailing at *a member's* deposit date, and the premature-withdrawal penalty
are engine rules for Phase 3, applied on top of this series. That penalty is
the actual educational content of a fixed deposit versus equity, so it must
not get lost by living nowhere: it is recorded in docs/DATA.md and in
docs/ENGINE_RULES.md as owed by Phase 3.

**Source convention.** RBI publishes the series as a range ("6.25 - 6.75"),
not a single figure. We take the **midpoint**, once, here. A row that cannot
be interpreted raises rather than silently taking the first number.

**Day count and compounding.** Interest accrues on a 365-day year and
compounds at calendar quarter ends. All arithmetic is Decimal at a fixed
precision so a rebuild is byte-identical.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, localcontext
from pathlib import Path

BASE_VALUE = Decimal(100)
DAY_COUNT = Decimal(365)
PRECISION = 34
RANGE_SEPARATORS = ("-", "–", "—", "to")


class RateError(ValueError):
    """A published rate row could not be interpreted. Never guessed around."""


@dataclass(frozen=True)
class Rate:
    effective_from: dt.date
    annual_percent: Decimal
    published: str


def parse_rate(text: str) -> Decimal:
    """
    "6.25 - 6.75" -> 6.50   (midpoint, the stated convention)
    "6.50"        -> 6.50
    anything else -> RateError
    """
    raw = text.strip()
    if not raw:
        raise RateError("empty rate")
    normalised = raw.replace("–", "-").replace("—", "-").replace(" to ", "-")
    # Empty parts are kept deliberately. Dropping them would turn "6.25-" and
    # "-4" into the single value 6.25 and 4, which is precisely the silent
    # first-number-wins behaviour this parser exists to refuse.
    parts = [p.strip() for p in normalised.split("-")]
    if len(parts) not in (1, 2) or any(not p for p in parts):
        raise RateError(f"cannot interpret rate {text!r}: expected a value or a range")
    try:
        values = [Decimal(p) for p in parts]
    except InvalidOperation as exc:
        raise RateError(f"cannot interpret rate {text!r}: not decimal numbers") from exc
    for v in values:
        if not v.is_finite() or v < 0 or v > 100:
            raise RateError(f"implausible rate {text!r}")
    if len(values) == 1:
        return values[0]
    low, high = values
    if high < low:
        raise RateError(f"range is inverted: {text!r}")
    return (low + high) / 2


def load_rates(path: Path) -> list[Rate]:
    """
    Read the published rate file. Lines beginning with `#` are provenance
    notes, not data: the file leads with several of them, so they are stripped
    before the header is read rather than being mistaken for it.
    """
    rows: list[Rate] = []
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not lines:
        raise RateError(f"{path}: file contains no rows")
    with io.StringIO("\n".join(lines)) as handle:
        for line_no, row in enumerate(csv.DictReader(handle), start=2):
            try:
                effective = dt.date.fromisoformat(row["effective_from"].strip())
                percent = parse_rate(row["rate_range_percent"])
            except (KeyError, ValueError, RateError) as exc:
                raise RateError(f"{path}:{line_no}: {exc}") from exc
            rows.append(Rate(effective, percent, row["rate_range_percent"].strip()))
    if not rows:
        raise RateError(f"{path}: no rate rows")
    rows.sort(key=lambda r: r.effective_from)
    return rows


def rate_on(rates: list[Rate], day: dt.date) -> Decimal:
    """The most recently published rate on or before `day`."""
    chosen: Decimal | None = None
    for rate in rates:
        if rate.effective_from <= day:
            chosen = rate.annual_percent
        else:
            break
    if chosen is None:
        raise RateError(f"no published rate on or before {day}")
    return chosen


def _is_quarter_end(day: dt.date) -> bool:
    return (day.month in (3, 6, 9, 12)) and (day + dt.timedelta(days=1)).month != day.month


def build_index(rates: list[Rate], trading_days: list[dt.date]) -> dict[dt.date, Decimal]:
    """
    Value of the index on each trading day, base 100 on the first one.

    Interest accrues every calendar day (including non-trading days, as a real
    deposit does) at the prevailing annual rate divided by 365, and is added to
    principal at each calendar quarter end.
    """
    if not trading_days:
        return {}
    with localcontext() as ctx:
        ctx.prec = PRECISION
        principal = BASE_VALUE
        accrued = Decimal(0)
        values: dict[dt.date, Decimal] = {}
        wanted = set(trading_days)
        day = trading_days[0]
        last = trading_days[-1]
        while day <= last:
            if day in wanted:
                values[day] = principal + accrued
            annual = rate_on(rates, day) / Decimal(100)
            accrued += principal * annual / DAY_COUNT
            if _is_quarter_end(day):
                principal += accrued
                accrued = Decimal(0)
            day += dt.timedelta(days=1)
        return values
