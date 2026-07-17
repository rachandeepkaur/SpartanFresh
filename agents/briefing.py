"""Briefing agent: turns one priority list into short, partner-specific
briefs -- not a shared dashboard everyone has to parse themselves.

Two briefs for the MVP (README section 9 minimum):
  - Marathon Kitchen internal: the full picture, for processing/capacity
    planning across every source.
  - Spartan Pantry: just the most urgent items, since that's what they need
    to act on before it turns.

Narrative text is template-based by default (free, deterministic, good
enough for a demo). If GEMINI_API_KEY is set, it asks Gemini to phrase it
more naturally instead, falling back to the template on any failure.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from schemas import Brief, PriorityEntry

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

PARTNER_LABELS = {
    "marathon_kitchen_internal": "Marathon Kitchen -- Internal",
    "spartan_pantry": "Spartan Food Pantry",
}


_NARRATIVE_MAX_ITEMS = 10


def _template_narrative(partner_label: str, items: list[PriorityEntry]) -> str:
    if not items:
        return f"No inbound items currently need {partner_label}'s attention."
    lines = [f"{partner_label} brief -- {len(items)} item(s) to plan around:"]
    for entry in items[:_NARRATIVE_MAX_ITEMS]:
        days = entry.estimated_days_remaining
        days_str = f"{days:.0f} day(s) left" if days is not None else "shelf life unknown"
        lines.append(
            f"- {entry.item}: {entry.quantity:g} {entry.unit} "
            f"from {entry.source_partner} ({entry.urgency}, {days_str})"
        )
    remaining = len(items) - _NARRATIVE_MAX_ITEMS
    if remaining > 0:
        lines.append(f"...and {remaining} more, lower-urgency item(s) -- see full inventory.")
    return "\n".join(lines)


def _gemini_narrative(partner_label: str, items: list[PriorityEntry]) -> str:
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)
    item_lines = "\n".join(
        f"- {e.item}: {e.quantity:g} {e.unit} from {e.source_partner}, "
        f"urgency={e.urgency}, days_remaining={e.estimated_days_remaining}"
        for e in items
    )
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=(
            f"Write a short (3-5 sentence), plain, action-oriented brief for "
            f"{partner_label} based on this ranked inventory. Lead with the "
            f"most urgent items. No headers, no bullet points, just prose.\n\n"
            f"{item_lines}"
        ),
    )
    return response.text.strip()


def _narrative(partner_label: str, items: list[PriorityEntry]) -> str:
    if GEMINI_API_KEY and items:
        try:
            return _gemini_narrative(partner_label, items)
        except Exception:
            pass
    return _template_narrative(partner_label, items)


def generate_briefs(ranked: list[PriorityEntry]) -> list[Brief]:
    now = datetime.now(timezone.utc)

    internal_items = ranked
    pantry_items = [e for e in ranked if e.urgency in ("critical", "use_soon")]

    briefs = [
        Brief(
            partner_id="marathon_kitchen_internal",
            partner_label=PARTNER_LABELS["marathon_kitchen_internal"],
            generated_at=now,
            headline=f"{len(internal_items)} inbound item(s) across all partners",
            items=internal_items,
            narrative=_narrative(PARTNER_LABELS["marathon_kitchen_internal"], internal_items),
        ),
        Brief(
            partner_id="spartan_pantry",
            partner_label=PARTNER_LABELS["spartan_pantry"],
            generated_at=now,
            headline=f"{len(pantry_items)} urgent item(s) to distribute promptly",
            items=pantry_items,
            narrative=_narrative(PARTNER_LABELS["spartan_pantry"], pantry_items),
        ),
    ]
    return briefs
