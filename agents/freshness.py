"""Freshness agent: estimates how many days an item has left.

Two paths:
  1. The item has a printed/scanned expiry date (canned goods, packaged
     donor items) -> compute days remaining directly. High confidence.
  2. No printed date (garden produce, pantry-logged fresh items) -> look up
     a typical shelf-life for that item. A real deployment would show a
     photo to Gemini's vision here for a condition read (fresh / use soon /
     spoiling); without an actual photo in the mock data, this MVP uses a
     shelf-life table as the offline stand-in, which is the same interface
     a vision call would fill in later. Medium confidence.
"""

from __future__ import annotations

from datetime import datetime, timezone

from schemas import CanonicalEvent, FreshnessTag, Urgency

SHELF_LIFE_DAYS_BY_ITEM: dict[str, int] = {
    "tomatoes": 7,
    "zucchini": 7,
    "bell peppers": 10,
    "cucumbers": 7,
    "green beans": 5,
    "sweet corn": 3,
    "lettuce": 5,
    "kale": 5,
    "carrots": 21,
    "summer squash": 7,
    "basil": 5,
    "radishes": 10,
    "eggplant": 7,
    "onions": 30,
    "watermelon": 14,
    "strawberries": 5,
    "bananas": 5,
    "milk": 10,
    "eggs": 21,
    "yogurt": 14,
    "cheese": 21,
    "bread": 5,
    "ground beef": 2,
    "chicken breast": 2,
    "frozen peas": 120,
}

SHELF_LIFE_DAYS_BY_CATEGORY: dict[str, int] = {
    "produce": 7,
    "dairy": 10,
    "frozen": 180,
    "bakery": 5,
    "canned": 730,
    "dry_goods": 365,
    "other": 14,
}


def _urgency_from_days(days_remaining: float) -> Urgency:
    if days_remaining <= 1:
        return "critical"
    if days_remaining <= 4:
        return "use_soon"
    if days_remaining <= 14:
        return "normal"
    return "low"


def estimate_freshness(event: CanonicalEvent, *, now: datetime | None = None) -> FreshnessTag:
    now = now or datetime.now(timezone.utc)

    if event.expiry_date is not None:
        days_remaining = (event.expiry_date - now).total_seconds() / 86400
        return FreshnessTag(
            event_id=event.id,
            item=event.item,
            estimated_days_remaining=round(days_remaining, 1),
            confidence="high",
            method="expiry_date",
            urgency=_urgency_from_days(days_remaining),
        )

    shelf_life_days = SHELF_LIFE_DAYS_BY_ITEM.get(
        event.item.lower(), SHELF_LIFE_DAYS_BY_CATEGORY[event.category]
    )
    days_since_available = max(0.0, (now - event.timestamp).total_seconds() / 86400)
    days_remaining = shelf_life_days - days_since_available
    return FreshnessTag(
        event_id=event.id,
        item=event.item,
        estimated_days_remaining=round(days_remaining, 1),
        confidence="medium",
        method="shelf_life_table",
        urgency=_urgency_from_days(days_remaining),
    )
