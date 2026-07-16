"""Translation agent: maps any partner's raw record onto the canonical
CanonicalEvent schema.

Known, stable formats (spartan_garden, community_donor) get a deterministic
mapping table -- fast, free, no model call. The pantry intake log uses a
different, dynamic key per item (see connectors/pantry_intake.py) so it
can't be handled by a lookup table; that falls back to a Claude call, and
if no ANTHROPIC_API_KEY is configured, to a regex-based heuristic that
mimics what the model call would produce so the pipeline still runs
end-to-end offline.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone

from schemas import CanonicalEvent

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# ---------------------------------------------------------------------------
# Partner A: Spartan Garden sheet (Crop, Lbs_Ready, Ready_Date) -- deterministic
# ---------------------------------------------------------------------------


def _translate_spartan_garden(raw: dict) -> dict:
    return {
        "item": raw["Crop"].strip(),
        "quantity": float(raw["Lbs_Ready"]),
        "unit": "lbs",
        "category": "produce",
        "direction": "inbound",
        "timestamp": datetime.strptime(raw["Ready_Date"], "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        ),
        "expiry_date": None,
    }


# ---------------------------------------------------------------------------
# Partner B: community donor form (item_scanned/qty/expiry) -- deterministic
# ---------------------------------------------------------------------------

# (display name, unit, category) per known item_scanned value
COMMUNITY_ITEM_MAP: dict[str, tuple[str, str, str]] = {
    "canned_beans": ("Canned Beans", "cans", "canned"),
    "canned_corn": ("Canned Corn", "cans", "canned"),
    "canned_soup": ("Canned Soup", "cans", "canned"),
    "canned_tuna": ("Canned Tuna", "cans", "canned"),
    "canned_green_beans": ("Canned Green Beans", "cans", "canned"),
    "canned_fruit": ("Canned Fruit", "cans", "canned"),
    "peanut_butter_jar": ("Peanut Butter", "jars", "dry_goods"),
    "pasta_box": ("Pasta", "boxes", "dry_goods"),
    "rice_bag_2lb": ("Rice (2lb)", "bags", "dry_goods"),
    "cereal_box": ("Cereal", "boxes", "dry_goods"),
    "applesauce_cup_pack": ("Applesauce Cups", "cup packs", "dry_goods"),
    "granola_bar_box": ("Granola Bars", "boxes", "dry_goods"),
    "oatmeal_canister": ("Oatmeal", "canisters", "dry_goods"),
    "mac_and_cheese_box": ("Mac and Cheese", "boxes", "dry_goods"),
}


def _translate_community_donor(raw: dict) -> dict:
    key = raw["item_scanned"]
    if key in COMMUNITY_ITEM_MAP:
        item, unit, category = COMMUNITY_ITEM_MAP[key]
    else:
        item, unit, category = key.replace("_", " ").title(), "units", "other"
    return {
        "item": item,
        "quantity": float(raw["qty"]),
        "unit": unit,
        "category": category,
        "direction": "inbound",
        "timestamp": datetime.now(timezone.utc),
        "expiry_date": datetime.strptime(raw["expiry"], "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        ),
    }


DETERMINISTIC_MAPPERS = {
    "spartan_garden": _translate_spartan_garden,
    "community_donor": _translate_community_donor,
}

# ---------------------------------------------------------------------------
# Partner C: pantry intake log -- dynamic key per item, no stable schema.
# Claude fallback (or heuristic mimic when no API key is configured).
# ---------------------------------------------------------------------------

_UNIT_TOKENS = "cans|lbs|gallons|loaves|heads|dozen|bags|cups|blocks"
_DYNAMIC_KEY_RE = re.compile(rf"^(?P<slug>[a-z_]+)_(?P<unit>{_UNIT_TOKENS})_available$")

_ITEM_CATEGORY_HINTS = {
    "beans": "canned",
    "corn": "canned",
    "tomatoes": "produce",
    "lettuce": "produce",
    "strawberries": "produce",
    "bananas": "produce",
    "milk": "dairy",
    "eggs": "dairy",
    "yogurt": "dairy",
    "cheese": "dairy",
    "bread": "bakery",
    "ground_beef": "frozen",
    "chicken_breast": "frozen",
    "frozen_peas": "frozen",
    "rice": "dry_goods",
}


def _heuristic_translate_dynamic(raw: dict) -> dict:
    """Regex-based stand-in for the Claude fallback, used when no API key
    is configured. Finds the `<item>_<unit>_available` key and infers
    category from a small hint table."""
    date_str = raw.get("date")
    key = next((k for k in raw if k != "date"), None)
    match = _DYNAMIC_KEY_RE.match(key) if key else None
    if not match:
        raise ValueError(f"Could not parse dynamic pantry intake record: {raw}")
    slug, unit = match["slug"], match["unit"]
    category = _ITEM_CATEGORY_HINTS.get(slug, "other")
    return {
        "item": slug.replace("_", " ").title(),
        "quantity": float(raw[key]),
        "unit": unit,
        "category": category,
        "direction": "inbound",
        "timestamp": datetime.strptime(date_str, "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        ),
        "expiry_date": None,
    }


_CLAUDE_TRANSLATION_PROMPT = """You translate raw inventory records from unfamiliar \
partner formats into a canonical schema.

Canonical fields: item (str), quantity (float), unit (str), category (one of \
produce, canned, dairy, frozen, bakery, dry_goods, other), direction \
("inbound" or "outbound"), timestamp (ISO 8601), expiry_date (ISO 8601 or null).

Raw record: {raw}

Respond with ONLY a JSON object with exactly those keys, no prose."""


def _claude_translate_dynamic(raw: dict) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": _CLAUDE_TRANSLATION_PROMPT.format(raw=json.dumps(raw)),
            }
        ],
    )
    text = message.content[0].text.strip()
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(text)
    parsed["timestamp"] = datetime.fromisoformat(parsed["timestamp"])
    parsed["expiry_date"] = (
        datetime.fromisoformat(parsed["expiry_date"]) if parsed.get("expiry_date") else None
    )
    return parsed


def _translate_unrecognized(raw: dict) -> tuple[dict, str]:
    """Try Claude first when configured; always have the heuristic as a
    safety net so a flaky or unconfigured model call never breaks the demo."""
    if ANTHROPIC_API_KEY:
        try:
            return _claude_translate_dynamic(raw), "claude"
        except Exception:
            pass
    return _heuristic_translate_dynamic(raw), "heuristic"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def translate(source_partner: str, raw: dict) -> CanonicalEvent:
    if source_partner in DETERMINISTIC_MAPPERS:
        fields = DETERMINISTIC_MAPPERS[source_partner](raw)
        translated_by = "deterministic"
    else:
        fields, translated_by = _translate_unrecognized(raw)

    return CanonicalEvent(
        id=str(uuid.uuid4()),
        source_partner=source_partner,
        raw=raw,
        translated_by=translated_by,
        **fields,
    )
