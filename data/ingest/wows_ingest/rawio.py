"""
Reading raw files and checksumming them.

`json.loads` coerces every JSON number to a Python float before any of our
code runs, which would silently break the no-float guarantee even though the
committed raw file holds full precision. `parse_float=Decimal` is the only
thing standing between the source text and a float, so it lives in one
function and is asserted by a test.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from pathlib import Path
from typing import Any


def load_json(text: str) -> Any:
    """Decode JSON with every number as Decimal, never float."""
    return json.loads(text, parse_float=Decimal)


def read_json(path: Path) -> Any:
    return load_json(path.read_text(encoding="utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_text_lf(path: Path, text: str) -> None:
    """
    Write with explicit LF endings and no trailing-newline surprises, so a
    rebuild on another machine is byte-identical.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
