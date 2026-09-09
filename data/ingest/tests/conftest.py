"""
A tiny synthetic snapshot that passes every check, so each test can break
exactly one thing and watch the right check fail.

The scenario window is narrowed to a handful of days so a fixture is ten rows
per instrument rather than twelve hundred; every other rule is the real one.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
from pathlib import Path

import pytest

from wows_ingest import config
from wows_ingest.rawio import sha256_file, write_text_lf

WINDOW_START = dt.date(2020, 1, 6)
WINDOW_END = dt.date(2020, 1, 17)


@pytest.fixture(autouse=True)
def narrow_window(monkeypatch):
    monkeypatch.setattr(config, "SCENARIO_WINDOW_START", WINDOW_START)
    monkeypatch.setattr(config, "SCENARIO_WINDOW_END", WINDOW_END)
    monkeypatch.setattr(config, "FETCH_START", WINDOW_START)
    monkeypatch.setattr(config, "FETCH_END", WINDOW_END)


def _csv(header: list[str], rows: list[list[str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def trading_days() -> list[dt.date]:
    day, out = WINDOW_START, []
    while day <= WINDOW_END:
        if day.weekday() < 5:
            out.append(day)
        day += dt.timedelta(days=1)
    return out


@pytest.fixture
def snapshot(tmp_path: Path):
    """Writes a clean snapshot and returns a handle for breaking it."""

    class Snapshot:
        def __init__(self, root: Path):
            self.dir = root
            self.days = trading_days()
            self.bars: list[list[str]] = []
            for inst in config.all_instruments():
                if inst.symbol == config.CASH_INSTRUMENT.symbol:
                    continue
                for offset, day in enumerate(self.days):
                    price = 10_000 + offset * 10
                    self.bars.append(
                        [inst.symbol, day.isoformat(), str(price), str(price + 50),
                         str(price - 50), str(price + 10), "1000"]
                    )
            self.policy = {
                "discontinuity_band": {"min_ratio": "0.6", "max_ratio": "1.6"},
                "exceptions": [],
                "source_defects": [],
                "illiquid_instruments": [],
                "known_source_gaps": [],
            }
            self.actions: list[list[str]] = []
            self.excluded: list[list[str]] = []
            self.write()

        def write(self) -> None:
            self.dir.mkdir(parents=True, exist_ok=True)
            write_text_lf(
                self.dir / "instruments.csv",
                _csv(["symbol", "name", "asset_class", "is_active", "role", "rationale"],
                     [[i.symbol, i.name, i.asset_class, "true", i.role, i.rationale]
                      for i in config.all_instruments()]),
            )
            write_text_lf(
                self.dir / "bars.csv",
                _csv(["symbol", "trade_date", "open_paise", "high_paise", "low_paise",
                      "close_paise", "volume"], self.bars),
            )
            write_text_lf(self.dir / "calendar.csv",
                          _csv(["trade_date"], [[d.isoformat()] for d in self.days]))
            write_text_lf(
                self.dir / "corporate-actions.csv",
                _csv(["symbol", "event_date", "kind", "ratio", "in_scenario_window", "source"],
                     self.actions),
            )
            write_text_lf(self.dir / "excluded-rows.csv",
                          _csv(["symbol", "trade_date", "reason"], self.excluded))
            write_text_lf(self.dir / "policy.json",
                          json.dumps(self.policy, indent=2, sort_keys=True) + "\n")

            per_instrument: dict[str, dict] = {}
            for row in self.bars:
                entry = per_instrument.setdefault(
                    row[0], {"rows": 0, "first_date": None, "last_date": None})
                entry["rows"] += 1
                entry["first_date"] = min(entry["first_date"] or row[1], row[1])
                entry["last_date"] = max(entry["last_date"] or row[1], row[1])
            per_instrument[config.CASH_INSTRUMENT.symbol] = {
                "rows": 0, "first_date": None, "last_date": None}
            manifest = {
                "snapshot_version": 1,
                "built_at": "2026-09-09T00:00:00+00:00",
                "fd_series_verified": False,
                "scenario_windows": [{"name": "test", "start": WINDOW_START.isoformat(),
                                      "end": WINDOW_END.isoformat()}],
                "per_instrument": dict(sorted(per_instrument.items())),
                "files": {},
            }
            for name in ("instruments.csv", "bars.csv", "calendar.csv",
                         "corporate-actions.csv", "excluded-rows.csv", "policy.json"):
                manifest["files"][name] = sha256_file(self.dir / name)
            write_text_lf(self.dir / "manifest.json",
                          json.dumps(manifest, indent=2, sort_keys=True) + "\n")

    return Snapshot(tmp_path / "v1")
