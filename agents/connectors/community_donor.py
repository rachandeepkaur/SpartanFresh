"""Community donor intake form, exported as JSONL: item_scanned/qty/expiry."""

import json
from pathlib import Path
from typing import Iterator

MOCK_PATH = Path(__file__).parent.parent / "mock_data" / "partner_b_community_donor.jsonl"


def read_community_donor() -> Iterator[dict]:
    with open(MOCK_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
