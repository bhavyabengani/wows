"""Paise conversion, including the inputs that trip people up."""

from decimal import Decimal

import pytest

from wows_ingest.money import PriceError, to_paise, to_volume


@pytest.mark.parametrize(
    "text,expected",
    [
        ("1234.565", 123457),   # exact tie, rounds away from zero (ENGINE_RULES.md)
        ("1234.555", 123456),   # would round the other way under banker's rounding
        ("0.005", 1),           # tie at the smallest unit
        ("0.004", 0),
        ("1,234.56", 123456),   # thousands separator as it appears in source files
        ("  12.30  ", 1230),    # surrounding space
        ("0", 0),
        ("1234.5600000", 123456),
        ("-0.005", -1),         # away from zero applies in both directions
        ("512.4834594726562", 51248),
    ],
)
def test_to_paise(text, expected):
    assert to_paise(text) == expected


def test_decimal_input_is_accepted():
    assert to_paise(Decimal("33.596")) == 3360


def test_float_is_refused_outright():
    # By the time a price is a float the damage is done and undetectable
    # downstream, so this is an error rather than a coercion.
    with pytest.raises(PriceError, match="float"):
        to_paise(1234.565)
    with pytest.raises(PriceError):
        to_volume(1000.0)


@pytest.mark.parametrize("bad", ["", "   ", "abc", "12.3.4", "NaN", "Infinity"])
def test_unparsable_prices_raise(bad):
    with pytest.raises(PriceError):
        to_paise(bad)


def test_volume():
    assert to_volume(None) == 0
    assert to_volume("1,043,400") == 1043400
    assert to_volume(Decimal("42")) == 42
    with pytest.raises(PriceError):
        to_volume(Decimal("1.5"))
