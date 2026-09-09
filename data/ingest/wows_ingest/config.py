"""
What v1 covers, and why. Changing anything here means a new snapshot version.

The curated universe exists because the club chose **restriction over
adjustment** for corporate actions (docs/DATA.md): rather than compute
adjustment factors and risk silent errors, the universe admits only
instruments with no split or bonus inside the replay window. Admissibility is
decided by the split events returned with the price data, not by eyeballing
the series, because the source retroactively adjusts historical prices so a
split leaves no visible jump.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

SNAPSHOT_VERSION = 1

# Fetch generously around the scenario windows so a later scenario does not
# need a refetch. Raw files are committed; build never goes to the network.
FETCH_START = dt.date(2007, 1, 1)
FETCH_END = dt.date(2026, 8, 31)

# The first scenario's replay window. Admissibility and the discontinuity
# check are both scoped to this, not to the full fetched history: a
# legitimate split in 2013 must not fail a 2019-2023 universe.
SCENARIO_WINDOW_START = dt.date(2019, 1, 1)
SCENARIO_WINDOW_END = dt.date(2023, 12, 31)

# The instrument whose trading days define the NSE calendar (docs/DATA.md).
CALENDAR_SOURCE_SYMBOL = "^NSEI"


@dataclass(frozen=True)
class Instrument:
    """One row of instruments.csv, plus how to fetch it."""

    symbol: str          # as stored in the database
    source_symbol: str   # as requested from the price source
    name: str
    asset_class: str     # must exist in the asset_class enum in src/db/schema.ts
    role: str            # what it stands for in the game
    rationale: str


EQUITIES: tuple[Instrument, ...] = tuple(
    Instrument(sym, f"{sym}.NS", name, "equity", "individual equity", rationale)
    for sym, name, rationale in [
        ("RELIANCE", "Reliance Industries", "Largest NSE constituent by weight."),
        ("TCS", "Tata Consultancy Services", "IT services bellwether."),
        ("INFY", "Infosys", "Second IT name, for sector-versus-stock questions."),
        ("ICICIBANK", "ICICI Bank", "Private bank, high beta through the window."),
        ("HINDUNILVR", "Hindustan Unilever", "Defensive FMCG; no split in living memory."),
        ("ITC", "ITC", "FMCG with a distinct regulatory risk story."),
        ("KOTAKBANK", "Kotak Mahindra Bank", "Private bank with a governance episode in window."),
        ("LT", "Larsen & Toubro", "Capital goods, the domestic capex cycle."),
        ("SBIN", "State Bank of India", "Public sector bank, contrast with private peers."),
        ("ASIANPAINT", "Asian Paints", "Long compounder that de-rated late in the window."),
        ("MARUTI", "Maruti Suzuki", "Autos, exposed to the 2019 slowdown."),
        ("TITAN", "Titan Company", "Discretionary consumption."),
        ("SUNPHARMA", "Sun Pharmaceutical", "Pharma, the 2020 re-rating."),
        ("ULTRACEMCO", "UltraTech Cement", "Cement, commodity cost pass-through."),
        ("AXISBANK", "Axis Bank", "Third private bank, for dispersion within a sector."),
        ("BAJFINANCE", "Bajaj Finance", "NBFC, the sharpest drawdown and recovery in window."),
    ]
)

PROXIES: tuple[Instrument, ...] = (
    Instrument("NIFTY50", "^NSEI", "Nifty 50 index", "index",
               "large-cap index", "Headline index; also defines the trading calendar."),
    Instrument("NIFTY500", "^CRSLDX", "Nifty 500 index", "index",
               "mid/small-cap breadth", "Broader index for breadth comparisons."),
    Instrument("NIFTYBEES", "NIFTYBEES.NS", "Nippon India ETF Nifty 50 BeES", "etf",
               "investable large-cap index fund",
               "The index itself cannot be bought; this is the investable stand-in."),
    Instrument("GOLDBEES", "GOLDBEES.NS", "Nippon India ETF Gold BeES", "commodity",
               "gold",
               "Rupee-denominated, NSE-traded, liquid from 2009; avoids an FX assumption."),
    Instrument("LTGILTBEES", "LTGILTBEES.NS", "Nippon India ETF Long Term Gilt", "bond",
               "government bonds",
               "Investable gilt exposure. History starts 2018-05-11, so it covers "
               "the 2019-2023 window but rules out a 2007-2011 scenario."),
)

# Synthetic, built from the RBI deposit-rate series rather than fetched as bars.
FD_INSTRUMENT = Instrument(
    "FD1Y", "", "Fixed deposit, 1-3 year rolling reinvestment index", "fixed_deposit",
    "fixed deposit",
    "A value index, not a traded price. See docs/DATA.md for the model and its limits.",
)

# Cash has no bars at all (loader asserts this).
CASH_INSTRUMENT = Instrument(
    "CASH", "", "Indian rupee, uninvested", "cash", "cash",
    "Holds value; earns nothing. No bars.",
)


def all_instruments() -> tuple[Instrument, ...]:
    return EQUITIES + PROXIES + (FD_INSTRUMENT, CASH_INSTRUMENT)


def priced_instruments() -> tuple[Instrument, ...]:
    """Instruments fetched from the price source (everything except FD and cash)."""
    return EQUITIES + PROXIES


def instrument_by_symbol(symbol: str) -> Instrument:
    for inst in all_instruments():
        if inst.symbol == symbol:
            return inst
    raise KeyError(symbol)
