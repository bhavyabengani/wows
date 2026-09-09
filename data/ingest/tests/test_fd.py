"""The deposit-rate parser and the index it produces."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

import pytest

from wows_ingest.fd import Rate, RateError, build_index, parse_rate


@pytest.mark.parametrize(
    "text,expected",
    [
        ("6.25-6.75", Decimal("6.5")),      # the stated convention: midpoint
        ("6.25 - 6.75", Decimal("6.5")),
        ("6.25 – 6.75", Decimal("6.5")),    # en dash, as RBI sometimes prints it
        ("5.00 to 6.00", Decimal("5.5")),
        ("6.50", Decimal("6.50")),          # a single figure is taken as given
    ],
)
def test_parse_rate(text, expected):
    assert parse_rate(text) == expected


@pytest.mark.parametrize("bad", ["", "  ", "abc", "6.25-", "6.25-6.75-7.00", "6.75-6.25", "-4"])
def test_unreadable_rate_raises_rather_than_guessing(bad):
    # Never silently take the first number out of something it cannot read.
    with pytest.raises(RateError):
        parse_rate(bad)


def test_implausible_rate_raises():
    with pytest.raises(RateError):
        parse_rate("250.0")


def test_index_starts_at_base_and_grows():
    rates = [Rate(dt.date(2019, 1, 1), Decimal("7.30"), "7.30")]
    days = [dt.date(2020, 1, d) for d in (6, 7, 8, 9, 10)]
    values = build_index(rates, days)
    assert values[days[0]] == Decimal(100)
    assert values[days[-1]] > values[days[0]]
    # 7.30% on 365 days is 0.02% a day, so four days is about 0.08%.
    assert Decimal("100.07") < values[days[-1]] < Decimal("100.09")


def test_a_higher_rate_accrues_faster():
    days = [dt.date(2020, 1, d) for d in (6, 7, 8, 9, 10)]
    low = build_index([Rate(dt.date(2019, 1, 1), Decimal("4.0"), "4.0")], days)
    high = build_index([Rate(dt.date(2019, 1, 1), Decimal("8.0"), "8.0")], days)
    assert high[days[-1]] > low[days[-1]]


def test_index_re_rates_when_a_new_rate_is_published():
    days = [dt.date(2020, 1, 6) + dt.timedelta(days=i) for i in range(0, 60, 7)]
    flat = build_index([Rate(dt.date(2019, 1, 1), Decimal("4.0"), "4.0")], days)
    stepped = build_index(
        [Rate(dt.date(2019, 1, 1), Decimal("4.0"), "4.0"),
         Rate(dt.date(2020, 2, 1), Decimal("9.0"), "9.0")],
        days,
    )
    assert stepped[days[-1]] > flat[days[-1]]


def test_no_rate_published_yet_raises():
    with pytest.raises(RateError):
        build_index([Rate(dt.date(2025, 1, 1), Decimal("6.0"), "6.0")], [dt.date(2020, 1, 6)])
