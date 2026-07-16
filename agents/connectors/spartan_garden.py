"""Spartan Garden's own tracking sheet: Crop, Lbs_Ready, Ready_Date.

Read untouched -- this is their existing format, not one we designed.
"""

import csv
from pathlib import Path
from typing import Iterator

MOCK_PATH = Path(__file__).parent.parent / "mock_data" / "partner_a_spartan_garden.csv"


def read_spartan_garden() -> Iterator[dict]:
    with open(MOCK_PATH, newline="") as f:
        yield from csv.DictReader(f)
