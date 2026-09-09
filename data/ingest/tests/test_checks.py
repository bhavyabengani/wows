"""
Every quality check, broken one at a time.

A check nobody has watched fail is a check nobody should trust, so each test
starts from a clean snapshot, violates exactly one rule, and asserts that the
matching check is the one that fails.
"""

from __future__ import annotations

import datetime as dt
import json

from wows_ingest.checks import run_checks


def failures(snapshot) -> str:
    return " | ".join(run_checks(snapshot.dir).failures)


def test_clean_fixture_passes():
    pass


def test_a_clean_snapshot_is_clean(snapshot):
    report = run_checks(snapshot.dir)
    assert report.is_clean, report.failures


def test_hand_edited_file_is_caught_by_the_manifest(snapshot):
    # The whole point of the manifest: a file changed after the build.
    text = (snapshot.dir / "bars.csv").read_text().replace("10000", "99999", 1)
    (snapshot.dir / "bars.csv").write_text(text)
    assert "manifest checksums" in failures(snapshot)


def test_row_count_mismatch_is_caught(snapshot):
    manifest = json.loads((snapshot.dir / "manifest.json").read_text())
    manifest["per_instrument"]["TCS"]["rows"] += 5
    (snapshot.dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    problems = failures(snapshot)
    assert "row counts match manifest" in problems


def test_duplicate_bar_is_caught(snapshot):
    snapshot.bars.append(list(snapshot.bars[0]))
    snapshot.write()
    assert "no duplicate (instrument, trade_date)" in failures(snapshot)


def test_zero_price_is_caught(snapshot):
    snapshot.bars[0][2] = "0"
    snapshot.write()
    assert "no zero or negative prices" in failures(snapshot)


def test_negative_price_is_caught(snapshot):
    snapshot.bars[0][5] = "-100"
    snapshot.write()
    assert "no zero or negative prices" in failures(snapshot)


def test_inconsistent_ohlc_is_caught(snapshot):
    # close above high
    snapshot.bars[0][5] = str(int(snapshot.bars[0][3]) + 1000)
    snapshot.write()
    assert "OHLC consistency" in failures(snapshot)


def test_low_above_open_is_caught(snapshot):
    snapshot.bars[0][4] = str(int(snapshot.bars[0][2]) + 1)
    snapshot.write()
    assert "OHLC consistency" in failures(snapshot)


def test_negative_volume_is_caught(snapshot):
    snapshot.bars[0][6] = "-1"
    snapshot.write()
    assert "no negative volume" in failures(snapshot)


def test_gap_inside_the_window_is_caught(snapshot):
    victim = snapshot.bars[3]
    snapshot.bars = [b for b in snapshot.bars if b is not victim]
    snapshot.write()
    problems = failures(snapshot)
    assert "no gaps inside a scenario window" in problems
    assert victim[1] in problems, "the report must name the missing date"


def test_a_removed_row_with_a_recorded_reason_is_not_a_gap(snapshot):
    victim = snapshot.bars[3]
    snapshot.bars = [b for b in snapshot.bars if b is not victim]
    snapshot.excluded.append([victim[0], victim[1], "recorded source defect: wrong scale"])
    snapshot.write()
    assert run_checks(snapshot.dir).is_clean


def test_an_excluded_row_without_a_reason_is_caught(snapshot):
    victim = snapshot.bars[3]
    snapshot.bars = [b for b in snapshot.bars if b is not victim]
    snapshot.excluded.append([victim[0], victim[1], ""])
    snapshot.write()
    assert "every excluded row states a reason" in failures(snapshot)


def test_bar_on_a_non_trading_day_is_caught(snapshot):
    snapshot.bars.append(["TCS", "2020-01-11", "100", "100", "100", "100", "1"])  # a Saturday
    snapshot.write()
    assert "every bar falls on a trading day" in failures(snapshot)


def test_split_inside_the_window_is_caught(snapshot):
    snapshot.actions.append(["TCS", "2020-01-08", "split_or_bonus", "2:1", "true", "source"])
    snapshot.write()
    problems = failures(snapshot)
    assert "no split or bonus inside a scenario window" in problems
    assert "TCS 2020-01-08" in problems


def test_split_outside_the_window_is_allowed(snapshot):
    snapshot.actions.append(["TCS", "2013-07-11", "split_or_bonus", "2:1", "false", "source"])
    snapshot.write()
    assert run_checks(snapshot.dir).is_clean


def test_price_discontinuity_inside_the_window_is_caught(snapshot):
    for row in snapshot.bars:
        if row[0] == "TCS" and row[1] == "2020-01-09":
            row[2] = row[3] = row[4] = row[5] = "100"  # a hundredfold collapse
    snapshot.write()
    assert "no unexplained price discontinuity" in failures(snapshot)


def test_a_discontinuity_with_a_recorded_exception_is_allowed(snapshot):
    for row in snapshot.bars:
        if row[0] == "TCS" and row[1] == "2020-01-09":
            row[2] = row[3] = row[4] = row[5] = "100"
    # A collapse and its recovery are two dated jumps, so each needs its own
    # exception; excusing one does not quietly excuse the other.
    snapshot.policy["exceptions"] = [
        {"symbol": "TCS", "date": "2020-01-09", "reason": "documented market event"},
        {"symbol": "TCS", "date": "2020-01-10", "reason": "recovery from the same event"},
    ]
    snapshot.write()
    problems = failures(snapshot)
    assert "no unexplained price discontinuity" not in problems


def test_instrument_missing_from_the_window_is_caught(snapshot):
    snapshot.bars = [b for b in snapshot.bars if b[0] != "TITAN"]
    snapshot.write()
    problems = failures(snapshot)
    assert "every instrument covers every scenario window" in problems
    assert "TITAN" in problems


def test_cash_with_bars_is_caught(snapshot):
    snapshot.bars.append(["CASH", "2020-01-06", "100", "100", "100", "100", "0"])
    snapshot.write()
    assert "cash has no bars" in failures(snapshot)


def test_illiquid_tolerance_allows_a_recorded_rate_and_catches_a_worse_one(snapshot):
    days = [b[1] for b in snapshot.bars if b[0] == "LTGILTBEES"]
    snapshot.bars = [b for b in snapshot.bars if not (b[0] == "LTGILTBEES" and b[1] == days[3])]
    snapshot.policy["illiquid_instruments"] = [
        {"symbol": "LTGILTBEES", "max_missing_fraction": "0.5", "reason": "thinly traded"}
    ]
    snapshot.write()
    assert run_checks(snapshot.dir).is_clean

    snapshot.policy["illiquid_instruments"][0]["max_missing_fraction"] = "0.01"
    snapshot.write()
    assert "recorded tolerance" in failures(snapshot)
