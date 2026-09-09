"""
Building a snapshot: determinism, and reading the raw price format.

The determinism test runs against the committed raw files rather than a
fixture, because that is the property that actually matters: someone in three
years, with no network, must be able to rebuild this snapshot exactly.
"""

from __future__ import annotations

import datetime as dt
import json
from decimal import Decimal
from pathlib import Path

import pytest

from wows_ingest.build import BuildError, build, parse_chart
from wows_ingest.rawio import sha256_file

RAW_ROOT = Path(__file__).resolve().parents[2] / "raw"
FETCH_DATE = "2026-09-09"
DATA_FILES = ("instruments.csv", "bars.csv", "calendar.csv", "corporate-actions.csv",
              "excluded-rows.csv")


def _chart(timestamps, opens, highs, lows, closes, volumes, splits=None):
    return {
        "chart": {
            "result": [
                {
                    "meta": {"gmtoffset": 19800},
                    "timestamp": timestamps,
                    "indicators": {"quote": [{"open": opens, "high": highs, "low": lows,
                                              "close": closes, "volume": volumes}]},
                    "events": {"splits": splits or {}},
                }
            ]
        }
    }


# 2020-01-06 09:15 IST and the next session.
T1, T2 = 1578281100, 1578367500


def test_parse_chart_converts_to_paise_without_float():
    bars, events, skipped = parse_chart(
        "TCS",
        _chart([T1, T2], [Decimal("1234.565"), Decimal("10.005")],
               [Decimal("1240"), Decimal("11")], [Decimal("1230"), Decimal("9")],
               [Decimal("1235"), Decimal("10.5")], [1000, 2000]),
    )
    assert [b["open_paise"] for b in bars] == [123457, 1001]
    assert all(isinstance(b["close_paise"], int) for b in bars)
    assert skipped == 0 and events == []


def test_rows_with_a_missing_price_are_skipped_and_counted():
    bars, _, skipped = parse_chart(
        "TCS",
        _chart([T1, T2], [Decimal("10"), None], [Decimal("11"), Decimal("11")],
               [Decimal("9"), Decimal("9")], [Decimal("10"), Decimal("10")], [1, 2]),
    )
    assert len(bars) == 1 and skipped == 1


def test_split_events_are_extracted_and_dated_in_ist():
    _, events, _ = parse_chart(
        "TCS",
        _chart([T1], [Decimal("10")], [Decimal("11")], [Decimal("9")], [Decimal("10")], [1],
               splits={"x": {"date": T2, "numerator": Decimal("2"),
                             "denominator": Decimal("1"), "splitRatio": "2:1"}}),
    )
    assert len(events) == 1
    assert events[0]["event_date"] == dt.date(2020, 1, 7)
    assert events[0]["ratio"] == "2:1"


def test_a_non_ist_exchange_is_refused():
    payload = _chart([T1], [Decimal("1")], [Decimal("1")], [Decimal("1")], [Decimal("1")], [1])
    payload["chart"]["result"][0]["meta"]["gmtoffset"] = 0
    with pytest.raises(BuildError, match="gmtoffset"):
        parse_chart("TCS", payload)


def test_a_source_error_is_refused():
    with pytest.raises(BuildError, match="error"):
        parse_chart("TCS", {"chart": {"error": {"code": "Not Found"}, "result": None}})


@pytest.mark.skipif(not (RAW_ROOT / "yahoo" / FETCH_DATE).is_dir(), reason="raw files not present")
def test_build_is_deterministic_and_offline(tmp_path, monkeypatch):
    """
    Building twice from the same committed raw files is byte-identical, and
    nothing reaches the network: the fetch module is never imported by build,
    so removing it entirely must not affect the result.
    """
    monkeypatch.setitem(__import__("sys").modules, "wows_ingest.fetch", None)

    first, second = tmp_path / "a", tmp_path / "b"
    manifest_a = build(RAW_ROOT, first, FETCH_DATE)
    manifest_b = build(RAW_ROOT, second, FETCH_DATE)

    for name in DATA_FILES:
        assert sha256_file(first / name) == sha256_file(second / name), f"{name} differs"

    # The manifest matches too, apart from the one field that records when the
    # build ran. If any other field drifts, that is a determinism bug.
    a, b = dict(manifest_a), dict(manifest_b)
    a.pop("built_at"), b.pop("built_at")
    assert a == b
    assert json.loads((first / "manifest.json").read_text())["files"]["bars.csv"] == \
        manifest_a["files"]["bars.csv"]


@pytest.mark.skipif(not (RAW_ROOT / "yahoo" / FETCH_DATE).is_dir(), reason="raw files not present")
def test_build_refuses_a_missing_raw_file(tmp_path):
    with pytest.raises(BuildError, match="no raw price files"):
        build(RAW_ROOT, tmp_path / "v9", "1999-01-01")
