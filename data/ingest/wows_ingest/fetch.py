"""
The only part of this pipeline that touches the network.

Writes raw responses verbatim to data/raw/<source>/<fetch-date>/ and stops.
Those files are committed, and `build` reads only them. Sources revise
history retroactively, so a rebuild that went back to the network would not
reproduce the same snapshot.

Why the chart endpoint directly, and not yfinance: yfinance decodes prices
into Python floats before any of our code sees them, which docs/ENGINE_RULES.md
forbids. We make the same request it makes and keep the response text, so the
digits in the committed file are the digits the source sent. curl_cffi is
still needed because the endpoint answers 429 to a client that does not look
like a browser at the TLS level.
"""

from __future__ import annotations

import datetime as dt
import time
from pathlib import Path

from . import config
from .rawio import write_text_lf

CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
IMPERSONATE = "chrome"
PAUSE_SECONDS = 0.7


class FetchError(RuntimeError):
    pass


def _session():
    try:
        from curl_cffi import requests  # imported lazily: build and check never need it
    except ImportError as exc:  # pragma: no cover - environment problem, not logic
        raise FetchError(
            "curl_cffi is required for fetch: pip install -r requirements.txt"
        ) from exc
    return requests.Session(impersonate=IMPERSONATE)


def fetch_prices(raw_root: Path, fetch_date: dt.date) -> list[Path]:
    """One JSON file per instrument, exactly as the endpoint returned it."""
    session = _session()
    out_dir = raw_root / "yahoo" / fetch_date.isoformat()
    written: list[Path] = []
    params = {
        "period1": int(dt.datetime.combine(config.FETCH_START, dt.time()).timestamp()),
        "period2": int(dt.datetime.combine(config.FETCH_END, dt.time()).timestamp()),
        "interval": "1d",
        # Split events are the authoritative corporate-action test. The source
        # retroactively adjusts OHLC, so a split leaves no jump to detect.
        "events": "div,split",
    }
    for inst in config.priced_instruments():
        url = CHART_URL.format(symbol=inst.source_symbol)
        response = session.get(url, params=params, timeout=45)
        if response.status_code != 200:
            raise FetchError(
                f"{inst.source_symbol}: HTTP {response.status_code}. "
                "A 429 means the source is rate-limiting this network; wait and retry."
            )
        path = out_dir / f"{inst.symbol}.json"
        write_text_lf(path, response.text)
        written.append(path)
        print(f"  {inst.symbol:12s} {len(response.text):>9,d} bytes -> {path}")
        time.sleep(PAUSE_SECONDS)
    return written


def fetch_bhavcopy_samples(raw_root: Path, fetch_date: dt.date, dates: list[dt.date]) -> list[Path]:
    """
    A handful of NSE end-of-day files, used only as a cross-check.

    Bhavcopy carries the price as it actually traded, with no retroactive
    adjustment. Comparing it against the built snapshot on a few dates is what
    tells us by how much the price source has adjusted history (docs/DATA.md).
    """
    session = _session()
    out_dir = raw_root / "nse-bhavcopy" / fetch_date.isoformat()
    written: list[Path] = []
    for day in dates:
        stamp = day.strftime("%Y%m%d")
        url = (
            "https://nsearchives.nseindia.com/content/cm/"
            f"BhavCopy_NSE_CM_0_0_0_{stamp}_F_0000.csv.zip"
        )
        response = session.get(url, timeout=60, headers={"Referer": "https://www.nseindia.com/"})
        if response.status_code != 200:
            print(f"  bhavcopy {day}: HTTP {response.status_code}, skipped")
            continue
        path = out_dir / f"bhavcopy-{stamp}.csv.zip"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
        written.append(path)
        print(f"  bhavcopy {day} {len(response.content):>9,d} bytes -> {path}")
        time.sleep(PAUSE_SECONDS)
    return written
