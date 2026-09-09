"""
Prices as integer paise (H12).

A price is never a Python float at any point in this pipeline. Source JSON is
decoded with `parse_float=Decimal` (see rawio.load_json), arithmetic is
Decimal, and the single conversion to `int` paise happens here.

Rounding follows docs/ENGINE_RULES.md: **half away from zero**, applied once,
at the point the value is produced. Python's `ROUND_HALF_UP` is exactly that
rule ("ties going away from zero"), despite the name. The Phase 2 brief's
parenthetical suggestion of ROUND_HALF_EVEN is superseded by ENGINE_RULES.md,
which was written in Phase 1 and is the authority.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

CENTI = Decimal("0.01")


class PriceError(ValueError):
    """A price could not be represented exactly as integer paise."""


def to_paise(value: str | Decimal) -> int:
    """
    Convert a rupee amount to integer paise.

    Accepts a string (as it appears in a source file, with optional commas and
    surrounding space) or a Decimal. A float is rejected outright: by the time
    a price is a float the damage is already done and cannot be detected
    downstream.

        to_paise("1234.565")  -> 123457   (tie, away from zero)
        to_paise("0.005")     ->      1
        to_paise("1,234.56")  -> 123456
    """
    if isinstance(value, float):
        raise PriceError(
            "float may never hold a price; parse source text with "
            "Decimal (see rawio.load_json and docs/ENGINE_RULES.md)"
        )
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text:
            raise PriceError("empty price")
        try:
            dec = Decimal(text)
        except InvalidOperation as exc:
            raise PriceError(f"not a decimal number: {value!r}") from exc
    elif isinstance(value, Decimal):
        dec = value
    else:
        raise PriceError(f"unsupported price type {type(value).__name__}")

    if not dec.is_finite():
        raise PriceError(f"non-finite price: {value!r}")
    return int(dec.quantize(CENTI, rounding=ROUND_HALF_UP) * 100)


def to_volume(value: str | Decimal | int | None) -> int:
    """Volume is a whole number of units. Null becomes 0; fractions are rejected."""
    if value is None:
        return 0
    if isinstance(value, float):
        raise PriceError("float may never hold a volume")
    if isinstance(value, int):
        return value
    dec = Decimal(str(value).strip().replace(",", "")) if not isinstance(value, Decimal) else value
    if dec != dec.to_integral_value():
        raise PriceError(f"fractional volume: {value!r}")
    return int(dec)
