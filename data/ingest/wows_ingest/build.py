"""
raw -> snapshot. Offline, deterministic, no network.

Everything written here is a committed artefact. Building twice from the same
raw files produces byte-identical data files; the only field that changes
between runs is `built_at` in the manifest, and the determinism test ignores
exactly that field and nothing else.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
from decimal import Decimal
from pathlib import Path

from . import config, fd, trading_calendar
from .money import to_paise, to_volume
from .rawio import read_json, sha256_file, write_text_lf

# NSE trades in IST, which has no daylight saving. Converting the source's
# epoch seconds with the machine's local zone would make the build depend on
# where it runs, so the offset is fixed here.
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
IST_GMT_OFFSET_SECONDS = 19800

BARS_HEADER = ["symbol", "trade_date", "open_paise", "high_paise", "low_paise", "close_paise", "volume"]
INSTRUMENTS_HEADER = ["symbol", "name", "asset_class", "is_active", "role", "rationale"]
CALENDAR_HEADER = ["trade_date"]
ACTIONS_HEADER = ["symbol", "event_date", "kind", "ratio", "in_scenario_window", "source"]
EXCLUDED_HEADER = ["symbol", "trade_date", "reason"]


class BuildError(RuntimeError):
    pass


def _csv(header: list[str], rows: list[list[str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def _epoch_to_ist_date(seconds: int) -> dt.date:
    return dt.datetime.fromtimestamp(int(seconds), tz=dt.timezone.utc).astimezone(IST).date()


def parse_chart(symbol: str, payload: dict) -> tuple[list[dict], list[dict], int]:
    """
    Pull bars and split events out of one raw chart response.

    Returns (bars, split_events, skipped_null_rows). Prices arrive as Decimal
    because rawio.load_json decodes them that way; they become integer paise
    here and never pass through float.
    """
    chart = payload.get("chart") or {}
    if chart.get("error"):
        raise BuildError(f"{symbol}: source returned an error: {chart['error']}")
    results = chart.get("result") or []
    if not results:
        raise BuildError(f"{symbol}: no result in raw file")
    result = results[0]

    meta = result.get("meta") or {}
    offset = meta.get("gmtoffset")
    if offset is not None and int(offset) != IST_GMT_OFFSET_SECONDS:
        raise BuildError(
            f"{symbol}: source reports gmtoffset {offset}, expected {IST_GMT_OFFSET_SECONDS} (IST)"
        )

    timestamps = result.get("timestamp") or []
    quotes = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    opens, highs = quotes.get("open") or [], quotes.get("high") or []
    lows, closes = quotes.get("low") or [], quotes.get("close") or []
    volumes = quotes.get("volume") or []

    bars: list[dict] = []
    skipped = 0
    for i, stamp in enumerate(timestamps):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        if o is None or h is None or l is None or c is None:
            skipped += 1
            continue
        bars.append(
            {
                "symbol": symbol,
                "trade_date": _epoch_to_ist_date(stamp),
                "open_paise": to_paise(o),
                "high_paise": to_paise(h),
                "low_paise": to_paise(l),
                "close_paise": to_paise(c),
                "volume": to_volume(volumes[i] if i < len(volumes) else None),
            }
        )

    events = []
    for raw_event in ((result.get("events") or {}).get("splits") or {}).values():
        day = _epoch_to_ist_date(raw_event["date"])
        events.append(
            {
                "symbol": symbol,
                "event_date": day,
                "kind": "split_or_bonus",
                "ratio": str(raw_event.get("splitRatio", "")),
                "in_scenario_window": config.SCENARIO_WINDOW_START <= day <= config.SCENARIO_WINDOW_END,
                "source": "price source split events",
            }
        )
    events.sort(key=lambda e: (e["symbol"], e["event_date"]))
    return bars, events, skipped


def build(raw_root: Path, snapshot_dir: Path, fetch_date: str) -> dict:
    yahoo_dir = raw_root / "yahoo" / fetch_date
    if not yahoo_dir.is_dir():
        raise BuildError(f"no raw price files at {yahoo_dir}; run fetch first")

    all_bars: list[dict] = []
    all_events: list[dict] = []
    skipped_by_symbol: dict[str, int] = {}
    source_files: list[dict] = []

    for inst in config.priced_instruments():
        path = yahoo_dir / f"{inst.symbol}.json"
        if not path.is_file():
            raise BuildError(f"missing raw file {path}")
        bars, events, skipped = parse_chart(inst.symbol, read_json(path))
        if not bars:
            raise BuildError(f"{inst.symbol}: raw file contains no usable bars")
        all_bars.extend(bars)
        all_events.extend(events)
        if skipped:
            skipped_by_symbol[inst.symbol] = skipped
        source_files.append(
            {"path": str(path.relative_to(raw_root.parent)), "sha256": sha256_file(path)}
        )

    # Drop bars a maintainer has recorded as defective in the source, and any
    # that are structurally impossible. Every dropped row is written to
    # excluded-rows.csv with its reason, so nothing disappears quietly.
    policy = _load_or_create_policy(snapshot_dir)
    all_bars, excluded = _apply_exclusions(all_bars, policy)

    # A date is a trading day if a quorum of instruments traded (docs/DATA.md).
    days_by_symbol: dict[str, set[dt.date]] = {}
    for bar in all_bars:
        days_by_symbol.setdefault(bar["symbol"], set()).add(bar["trade_date"])
    calendar = trading_calendar.derive(days_by_symbol)
    if not calendar:
        raise BuildError("no date reached quorum; the raw files are probably incomplete")

    # The calendar is authoritative: a bar on a date the market was not open,
    # by our own definition of open, cannot be checked and is not carried.
    trading_days = set(calendar)
    span_start, span_end = calendar[0], calendar[-1]
    kept_bars: list[dict] = []
    for bar in all_bars:
        day = bar["trade_date"]
        if not (span_start <= day <= span_end):
            excluded.append({"symbol": bar["symbol"], "trade_date": day,
                             "reason": "outside the derived calendar span"})
        elif day not in trading_days:
            excluded.append({"symbol": bar["symbol"], "trade_date": day,
                             "reason": "date did not reach quorum as a trading day"})
        else:
            kept_bars.append(bar)
    all_bars = kept_bars

    # Fixed deposit, built from the published rate series rather than fetched.
    rates_path = _latest_rates_file(raw_root)
    rates = fd.load_rates(rates_path)
    source_files.append(
        {"path": str(rates_path.relative_to(raw_root.parent)), "sha256": sha256_file(rates_path)}
    )
    for day, value in sorted(fd.build_index(rates, calendar).items()):
        paise = to_paise(value)
        all_bars.append(
            {
                "symbol": config.FD_INSTRUMENT.symbol,
                "trade_date": day,
                "open_paise": paise,
                "high_paise": paise,
                "low_paise": paise,
                "close_paise": paise,
                "volume": 0,
            }
        )

    all_bars.sort(key=lambda b: (b["symbol"], b["trade_date"]))
    all_events.sort(key=lambda e: (e["symbol"], e["event_date"]))

    snapshot_dir.mkdir(parents=True, exist_ok=True)
    write_text_lf(
        snapshot_dir / "instruments.csv",
        _csv(
            INSTRUMENTS_HEADER,
            [
                [i.symbol, i.name, i.asset_class, "true", i.role, i.rationale]
                for i in config.all_instruments()
            ],
        ),
    )
    write_text_lf(
        snapshot_dir / "bars.csv",
        _csv(
            BARS_HEADER,
            [
                [
                    b["symbol"],
                    b["trade_date"].isoformat(),
                    str(b["open_paise"]),
                    str(b["high_paise"]),
                    str(b["low_paise"]),
                    str(b["close_paise"]),
                    str(b["volume"]),
                ]
                for b in all_bars
            ],
        ),
    )
    write_text_lf(snapshot_dir / "calendar.csv", _csv(CALENDAR_HEADER, [[d.isoformat()] for d in calendar]))
    write_text_lf(
        snapshot_dir / "corporate-actions.csv",
        _csv(
            ACTIONS_HEADER,
            [
                [e["symbol"], e["event_date"].isoformat(), e["kind"], e["ratio"],
                 "true" if e["in_scenario_window"] else "false", e["source"]]
                for e in all_events
            ],
        ),
    )
    excluded.sort(key=lambda e: (e["symbol"], e["trade_date"]))
    write_text_lf(
        snapshot_dir / "excluded-rows.csv",
        _csv(EXCLUDED_HEADER,
             [[e["symbol"], e["trade_date"].isoformat(), e["reason"]] for e in excluded]),
    )

    per_instrument = {}
    for bar in all_bars:
        entry = per_instrument.setdefault(
            bar["symbol"], {"rows": 0, "first_date": None, "last_date": None}
        )
        entry["rows"] += 1
        day = bar["trade_date"].isoformat()
        if entry["first_date"] is None or day < entry["first_date"]:
            entry["first_date"] = day
        if entry["last_date"] is None or day > entry["last_date"]:
            entry["last_date"] = day
    per_instrument[config.CASH_INSTRUMENT.symbol] = {"rows": 0, "first_date": None, "last_date": None}

    manifest = {
        "snapshot_version": config.SNAPSHOT_VERSION,
        "built_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "fetch_date": fetch_date,
        "fetch_range": {"start": config.FETCH_START.isoformat(), "end": config.FETCH_END.isoformat()},
        "scenario_windows": [
            {
                "name": "first-scenario",
                "start": config.SCENARIO_WINDOW_START.isoformat(),
                "end": config.SCENARIO_WINDOW_END.isoformat(),
            }
        ],
        "corporate_action_policy": (
            "Restriction, not adjustment. An instrument is admissible only if the source "
            "reports no split or bonus event inside a scenario window. Prices are stored as "
            "the source returned them, which means they are adjusted for splits occurring "
            "AFTER the window; see docs/DATA.md."
        ),
        # How to read every price in this snapshot. Carried through the loader
        # onto the snapshot record so a screen can say "adjusted close (as of
        # ...)" rather than printing a bare rupee figure that does not match
        # what traded. See docs/DATA.md.
        "is_adjusted": True,
        "adjusted_as_of": fetch_date,
        "adjusted_for": ["splits", "bonuses"],
        "not_adjusted_for": ["dividends", "rights issues"],
        "price_basis": "price_return",
        "dividends_included": False,
        "calendar_source": config.CALENDAR_SOURCE_SYMBOL,
        "calendar_days": len(calendar),
        "rounding": "half away from zero to paise, per docs/ENGINE_RULES.md",
        "fd_series_verified": False,
        "calendar_rule": (
            f"a date is a trading day if at least "
            f"{trading_calendar.quorum_size(len(config.priced_instruments()))} of "
            f"{len(config.priced_instruments())} priced instruments have a bar on it"
        ),
        "skipped_null_rows": skipped_by_symbol,
        "excluded_rows": len(excluded),
        "per_instrument": dict(sorted(per_instrument.items())),
        "source_files": sorted(source_files, key=lambda f: f["path"]),
        "files": {},
    }
    for name in ("instruments.csv", "bars.csv", "calendar.csv", "corporate-actions.csv",
                 "excluded-rows.csv", "policy.json"):
        manifest["files"][name] = sha256_file(snapshot_dir / name)

    write_text_lf(snapshot_dir / "manifest.json", json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest


def _latest_rates_file(raw_root: Path) -> Path:
    rbi_root = raw_root / "rbi"
    candidates = sorted(rbi_root.glob("*/term-deposit-rates-1-3y.csv"))
    if not candidates:
        raise BuildError(f"no deposit-rate file under {rbi_root}")
    return candidates[-1]


def _load_or_create_policy(snapshot_dir: Path) -> dict:
    """
    The band, its exceptions and the recorded source defects live in the
    snapshot rather than in code, so a maintainer can record a real market
    event or a bad vendor row without a code change. Written once as a
    template and never overwritten, so those edits survive a rebuild.

    The first build of a new snapshot therefore produces something the checks
    reject; the check report names every offending row, and the maintainer
    writes down a reason for each before it can pass. That is the intended
    workflow: no snapshot becomes clean until a human has explained it.
    """
    path = snapshot_dir / "policy.json"
    if not path.exists():
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        write_text_lf(
            path,
            json.dumps(
                {
                    "_comment": (
                        "Hand-maintained. `discontinuity_band` bounds the day-over-day close "
                        "ratio inside a scenario window. `exceptions` excuses a single dated "
                        "jump that a real market event explains. `source_defects` removes rows "
                        "the data source itself has wrong; each needs a reason a reader can "
                        "check, and each leaves a documented gap rather than an invented price."
                    ),
                    "discontinuity_band": {"min_ratio": "0.6", "max_ratio": "1.6"},
                    "exceptions": [],
                    "source_defects": [],
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
        )
    return read_json(path)


def _apply_exclusions(bars: list[dict], policy: dict) -> tuple[list[dict], list[dict]]:
    """Remove recorded source defects and structurally impossible rows."""
    defects = [
        (d["symbol"], dt.date.fromisoformat(d["from"]), dt.date.fromisoformat(d["to"]), d["reason"])
        for d in policy.get("source_defects", [])
    ]
    kept: list[dict] = []
    excluded: list[dict] = []
    for bar in bars:
        reason = None
        for symbol, start, end, why in defects:
            if bar["symbol"] == symbol and start <= bar["trade_date"] <= end:
                reason = f"recorded source defect: {why}"
                break
        if reason is None:
            o, h, l, c = bar["open_paise"], bar["high_paise"], bar["low_paise"], bar["close_paise"]
            if min(o, h, l, c) <= 0:
                reason = "source reported a zero or negative price"
            elif not (l <= o <= h and l <= c <= h):
                reason = "source reported inconsistent OHLC"
        if reason is None:
            kept.append(bar)
        else:
            excluded.append({"symbol": bar["symbol"], "trade_date": bar["trade_date"], "reason": reason})
    return kept, excluded
