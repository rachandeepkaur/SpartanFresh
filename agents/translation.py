"""Translation agent: maps any partner's raw record onto the canonical
CanonicalEvent schema.

Known, stable formats (spartan_garden, community_donor) get a deterministic
mapping table -- fast, free, no model call. The pantry intake log uses a
different, dynamic key per item (see connectors/pantry_intake.py) so it
can't be handled by a lookup table; that falls back to a Gemini call, and
if no GEMINI_API_KEY is configured, to a regex-based heuristic that
mimics what the model call would produce so the pipeline still runs
end-to-end offline.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date, datetime, timezone

from schemas import Category, CanonicalEvent

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

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
# Gemini fallback (or heuristic mimic when no API key is configured).
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
    """Regex-based stand-in for the Gemini fallback, used when no API key
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


_GEMINI_TRANSLATION_PROMPT = """You translate raw inventory records from unfamiliar \
partner formats into a canonical schema.

Canonical fields: item (str), quantity (float), unit (str), category (one of \
produce, canned, dairy, frozen, bakery, dry_goods, other), direction \
("inbound" or "outbound"), timestamp (ISO 8601), expiry_date (ISO 8601 or null).

Raw record: {raw}

Respond with ONLY a JSON object with exactly those keys, no prose."""


def _parse_iso(value: str) -> datetime:
    """datetime.fromisoformat on Python <3.11 can't parse a trailing 'Z'
    (Gemini's default timestamp format), so normalize it to +00:00 first.
    Gemini also doesn't always include a timezone at all -- assume UTC for
    the ones that don't, since every other stage compares tz-aware datetimes."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _gemini_translate_dynamic(raw: dict) -> dict:
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=_GEMINI_TRANSLATION_PROMPT.format(raw=json.dumps(raw)),
    )
    text = response.text.strip()
    text = re.sub(r"^```(json)?|```$", "", text, flags=re.MULTILINE).strip()
    parsed = json.loads(text)
    parsed["item"] = parsed["item"].strip().title()
    parsed["timestamp"] = _parse_iso(parsed["timestamp"])
    parsed["expiry_date"] = (
        _parse_iso(parsed["expiry_date"]) if parsed.get("expiry_date") else None
    )
    return parsed


def _translate_unrecognized(raw: dict) -> tuple[dict, str]:
    """Try Gemini first when configured; always have the heuristic as a
    safety net so a flaky or unconfigured model call never breaks the demo."""
    if GEMINI_API_KEY:
        try:
            return _gemini_translate_dynamic(raw), "gemini"
        except Exception:
            pass
    return _heuristic_translate_dynamic(raw), "heuristic"


# ---------------------------------------------------------------------------
# Dashboard uploads: a program manager attaches a partner's own spreadsheet
# (csv/xlsx) instead of a code connector reading it automatically. Column
# names are matched loosely (case/spacing-insensitive) against a few aliases
# per canonical field, rather than requiring one exact template -- the same
# flexibility the deterministic mappers above give each known partner, just
# driven by headers instead of a hardcoded key.
# ---------------------------------------------------------------------------

_UPLOAD_FIELD_ALIASES: dict[str, set[str]] = {
    "item": {"item", "name", "product", "crop", "item_name"},
    "quantity": {"quantity", "qty", "amount", "lbs_ready"},
    "unit": {"unit", "units"},
    "category": {"category", "type"},
    "expiry_date": {"expiry_date", "expiry", "expiration", "expiration_date", "use_by", "best_by"},
    "timestamp": {"date", "timestamp", "reported_date", "ready_date"},
}

_VALID_CATEGORIES = set(Category.__args__)
_UPLOAD_DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y")


def _normalize_header(key: str) -> str:
    return re.sub(r"[\s_]+", "_", str(key).strip().lower())


def _find_upload_field(row: dict, field: str) -> str | None:
    aliases = _UPLOAD_FIELD_ALIASES[field]
    for key in row:
        if _normalize_header(key) in aliases:
            return key
    return None


def _parse_upload_date(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    for fmt in _UPLOAD_DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return _parse_iso(text)
    except ValueError:
        return None


def _translate_upload_row(raw: dict) -> dict:
    item_key = _find_upload_field(raw, "item")
    qty_key = _find_upload_field(raw, "quantity")
    if not item_key or raw.get(item_key) in (None, ""):
        raise ValueError("missing an item/name/crop column")
    if not qty_key or raw.get(qty_key) in (None, ""):
        raise ValueError("missing a quantity/qty/amount column")

    item = str(raw[item_key]).strip()
    quantity = float(raw[qty_key])
    if not item:
        raise ValueError("item name is empty")
    if quantity <= 0:
        raise ValueError(f"quantity must be positive, got {quantity!r}")

    unit_key = _find_upload_field(raw, "unit")
    unit = str(raw[unit_key]).strip() if unit_key and raw.get(unit_key) not in (None, "") else "units"

    category_key = _find_upload_field(raw, "category")
    category = str(raw[category_key]).strip().lower() if category_key and raw.get(category_key) else ""
    if category not in _VALID_CATEGORIES:
        category = _ITEM_CATEGORY_HINTS.get(_normalize_header(item), "other")

    expiry_key = _find_upload_field(raw, "expiry_date")
    expiry_date = _parse_upload_date(raw[expiry_key]) if expiry_key else None

    timestamp_key = _find_upload_field(raw, "timestamp")
    timestamp = (_parse_upload_date(raw[timestamp_key]) if timestamp_key else None) or datetime.now(
        timezone.utc
    )

    return {
        "item": item,
        "quantity": quantity,
        "unit": unit,
        "category": category,
        "direction": "inbound",
        "timestamp": timestamp,
        "expiry_date": expiry_date,
    }


def translate_upload_row(source_partner: str, raw: dict) -> CanonicalEvent:
    """Translate one row of a dashboard-uploaded spreadsheet. Raises
    ValueError with a human-readable reason for rows that can't be mapped,
    so the caller can report per-row errors instead of failing the whole
    upload on one bad line."""
    fields = _translate_upload_row(raw)
    return CanonicalEvent(
        id=str(uuid.uuid4()),
        source_partner=source_partner,
        raw=raw,
        translated_by="deterministic",
        **fields,
    )


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
