"""Canonical data shapes shared by every stage of the pipeline."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Direction = Literal["inbound", "outbound"]
Category = Literal["produce", "canned", "dairy", "frozen", "bakery", "dry_goods", "other"]
Urgency = Literal["critical", "use_soon", "normal", "low"]


class CanonicalEvent(BaseModel):
    """One inventory event, regardless of which partner reported it."""

    id: str
    item: str
    quantity: float
    unit: str
    category: Category
    source_partner: str
    direction: Direction
    timestamp: datetime
    expiry_date: Optional[datetime] = None
    raw: dict = Field(default_factory=dict)
    translated_by: Literal["deterministic", "claude", "heuristic"] = "deterministic"


class FreshnessTag(BaseModel):
    event_id: str
    item: str
    estimated_days_remaining: Optional[float] = None
    confidence: Literal["high", "medium", "low"]
    method: Literal["expiry_date", "claude_vision", "shelf_life_table"]
    urgency: Urgency


class PriorityEntry(BaseModel):
    rank: int
    event_id: str
    item: str
    quantity: float
    unit: str
    source_partner: str
    urgency: Urgency
    estimated_days_remaining: Optional[float] = None


class Brief(BaseModel):
    partner_id: str
    partner_label: str
    generated_at: datetime
    headline: str
    items: list[PriorityEntry]
    narrative: str
