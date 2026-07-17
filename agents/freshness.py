"""Freshness agent: estimates how many days an item has left.

Two paths:
  1. The item has a printed/scanned expiry date (canned goods, packaged
     donor items) -> compute days remaining directly. High confidence.
  2. Produce with an MQ3 sensor reading -> use the trained ethylene-proxy
     model in ``freshness_agent.py`` when its model artifact is available.
  3. Everything else -> use the existing shelf-life table as a dependable
     offline fallback.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

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


def _raw_value(raw: dict[str, Any], *names: str) -> Any:
    """Return the first present, non-empty value under any supported alias."""
    for name in names:
        value = raw.get(name)
        if value is not None and value != "":
            return value
    return None


@lru_cache(maxsize=1)
def _mq3_agent():
    """Load the optional model once rather than once per inventory item.

    Imports are deliberately lazy: deployments without the ML extras or a
    trained model can still run the expiry-date and shelf-life paths.
    """
    try:
        from freshness_agent import FreshnessAgent
    except (ImportError, ModuleNotFoundError):
        return None

    agent = FreshnessAgent()
    return agent if agent.model_bundle is not None else None


def _estimate_from_mq3(
    event: CanonicalEvent, *, now: datetime
) -> FreshnessTag | None:
    raw = event.raw or {}
    mq3 = _raw_value(
        raw,
        "mq3_sensor_output",
        "MQ3 Sensor Output",
        "mq3",
    )
    if event.category != "produce" or mq3 is None:
        return None

    agent = _mq3_agent()
    if agent is None:
        return None

    model_input = {
        **raw,
        "item": event.item,
        "category": event.category,
        "mq3_sensor_output": mq3,
    }
    result = agent.evaluate_item(model_input, today=now.date())
    if result.method != "mq3_ethylene_model":
        return None

    if result.confidence >= 0.8:
        confidence = "high"
    elif result.confidence >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    return FreshnessTag(
        event_id=event.id,
        item=event.item,
        estimated_days_remaining=round(result.remaining_days, 1),
        confidence=confidence,
        method="mq3_ethylene_model",
        urgency=_urgency_from_days(result.remaining_days),
    )


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

    mq3_tag = _estimate_from_mq3(event, now=now)
    if mq3_tag is not None:
        return mq3_tag

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
