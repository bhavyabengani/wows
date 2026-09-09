"""Command line: fetch (network), build (offline), check (offline)."""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from . import config
from .build import build
from .checks import run_checks
from .rawio import write_text_lf

DATA_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = DATA_ROOT / "raw"
SNAPSHOT_ROOT = DATA_ROOT / "snapshots"


def _snapshot_dir(version: int) -> Path:
    return SNAPSHOT_ROOT / f"v{version}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="wows_ingest", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="download raw source files (the only networked step)")
    p_fetch.add_argument("--date", default=dt.date.today().isoformat(), help="fetch date folder")
    p_fetch.add_argument("--bhavcopy", action="store_true", help="also fetch NSE cross-check samples")

    p_build = sub.add_parser("build", help="raw -> snapshot, offline and deterministic")
    p_build.add_argument("--fetch-date", required=True, help="which raw folder to build from")
    p_build.add_argument("--version", type=int, default=config.SNAPSHOT_VERSION)

    p_check = sub.add_parser("check", help="validate a snapshot; exit 1 on any failure")
    p_check.add_argument("--version", type=int, default=config.SNAPSHOT_VERSION)
    p_check.add_argument("--write-report", action="store_true", help="write check-report.txt")

    args = parser.parse_args(argv)

    if args.command == "fetch":
        from .fetch import fetch_bhavcopy_samples, fetch_prices

        fetch_date = dt.date.fromisoformat(args.date)
        print(f"Fetching prices into {RAW_ROOT / 'yahoo' / args.date}")
        fetch_prices(RAW_ROOT, fetch_date)
        if args.bhavcopy:
            samples = [dt.date(2024, 8, 1), dt.date(2024, 12, 2), dt.date(2025, 3, 3)]
            print("Fetching NSE cross-check samples")
            fetch_bhavcopy_samples(RAW_ROOT, fetch_date, samples)
        print("Raw files written. Commit them: build must never go to the network.")
        return 0

    if args.command == "build":
        target = _snapshot_dir(args.version)
        manifest = build(RAW_ROOT, target, args.fetch_date)
        print(f"Built v{args.version}: {sum(e['rows'] for e in manifest['per_instrument'].values()):,} bars")
        print(f"  bars.csv sha256 {manifest['files']['bars.csv']}")
        return 0

    target = _snapshot_dir(args.version)
    report = run_checks(target)
    text = report.render(target)
    print(text)
    if args.write_report:
        write_text_lf(target / "check-report.txt", text)
    return 0 if report.is_clean else 1


if __name__ == "__main__":
    sys.exit(main())
