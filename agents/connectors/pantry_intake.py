"""Spartan Pantry's intake log: one dynamic key per item, e.g.
{"beans_cans_available": 50, "date": "2026-07-16"}.

The key name embeds the item and unit, and changes per record -- there's no
stable field name to map deterministically. This is the format the
translation agent can't handle with a lookup table, so it falls back to the
Claude (or heuristic) translator. See translation.py.
"""

import json
from pathlib import Path
from typing import Iterator

MOCK_PATH = Path(__file__).parent.parent / "mock_data" / "partner_c_pantry_intake.jsonl"


def read_pantry_intake() -> Iterator[dict]:
    with open(MOCK_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
