"""
The no-float guarantee.

`json.loads` turns every JSON number into a Python float before any of our
code runs, so a raw file that holds full precision would still reach us
already rounded. `parse_float=Decimal` is the single line preventing that; it
is one word to regress and nothing else would notice, so it is asserted here
directly and again at the source level.
"""

from __future__ import annotations

import ast
import json
from decimal import Decimal
from pathlib import Path

import pytest

from wows_ingest import rawio

PACKAGE = Path(rawio.__file__).parent
PRICE_MODULES = ["build.py", "money.py", "rawio.py", "fd.py", "checks.py"]


def test_load_json_yields_decimal_not_float():
    payload = '{"close": 512.4834594726562, "volume": 1043400}'
    parsed = rawio.load_json(payload)
    assert isinstance(parsed["close"], Decimal)
    assert not isinstance(parsed["close"], float)
    # Full precision survives; the plain decoder loses it.
    assert str(parsed["close"]) == "512.4834594726562"
    assert isinstance(json.loads(payload)["close"], float)


def test_load_json_is_the_only_json_entry_point():
    """No module may call json.loads directly and skip parse_float=Decimal."""
    offenders = []
    for name in PRICE_MODULES:
        tree = ast.parse((PACKAGE / name).read_text())
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if (
                isinstance(func, ast.Attribute)
                and func.attr in {"loads", "load"}
                and isinstance(func.value, ast.Name)
                and func.value.id == "json"
                and name != "rawio.py"
            ):
                offenders.append(f"{name}:{node.lineno} calls json.{func.attr} directly")
    assert offenders == [], "; ".join(offenders)


def test_no_module_converts_a_value_to_float():
    """`float(...)` never appears where a price could pass through it."""
    offenders = []
    for name in PRICE_MODULES:
        tree = ast.parse((PACKAGE / name).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id == "float":
                    offenders.append(f"{name}:{node.lineno}")
    assert offenders == [], f"float() called at {', '.join(offenders)}"


@pytest.mark.parametrize("module", PRICE_MODULES)
def test_no_float_annotations_on_price_paths(module):
    source = (PACKAGE / module).read_text()
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign) and isinstance(node.annotation, ast.Name):
            assert node.annotation.id != "float", f"{module}:{node.lineno} annotates a float"
