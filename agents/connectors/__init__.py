"""One adapter per partner data source.

Each connector reads whatever format that partner already uses (a CSV sheet,
a JSONL export of form submissions, an intake log) and yields raw records
tagged with which partner they came from. Nothing here touches the canonical
schema -- that's the translation agent's job (see ../translation.py).
"""

from .community_donor import read_community_donor
from .pantry_intake import read_pantry_intake
from .spartan_garden import read_spartan_garden

CONNECTORS = {
    "spartan_garden": read_spartan_garden,
    "community_donor": read_community_donor,
    "spartan_pantry_intake": read_pantry_intake,
}


def read_all() -> list[tuple[str, dict]]:
    """Return (source_partner, raw_record) pairs from every connector."""
    records: list[tuple[str, dict]] = []
    for source_partner, reader in CONNECTORS.items():
        for raw in reader():
            records.append((source_partner, raw))
    return records
