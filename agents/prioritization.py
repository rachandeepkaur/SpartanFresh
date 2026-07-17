"""Prioritization agent: ranks inbound inventory by urgency, on one
scale that spans every category and every partner.

Sort key: least time remaining first (None treated as "unknown, urgent
enough to check"), ties broken by larger quantity first since more volume
at the same urgency needs earlier attention.
"""

from __future__ import annotations

from schemas import CanonicalEvent, FreshnessTag, PriorityEntry

_URGENCY_RANK = {"critical": 0, "use_soon": 1, "normal": 2, "low": 3}


def prioritize(
    events: list[CanonicalEvent], freshness_tags: list[FreshnessTag]
) -> list[PriorityEntry]:
    tags_by_event: dict[str, FreshnessTag] = {}
    duplicate_tag_ids: set[str] = set()
    for tag in freshness_tags:
        if tag.event_id in tags_by_event:
            duplicate_tag_ids.add(tag.event_id)
        tags_by_event[tag.event_id] = tag

    if duplicate_tag_ids:
        duplicates = ", ".join(sorted(duplicate_tag_ids))
        raise ValueError(f"Duplicate freshness tags for event IDs: {duplicates}")

    inbound = [
        event
        for event in events
        if event.direction == "inbound" and event.quantity > 0
    ]
    missing_tag_ids = sorted(
        event.id for event in inbound if event.id not in tags_by_event
    )
    if missing_tag_ids:
        missing = ", ".join(missing_tag_ids)
        raise ValueError(f"Missing freshness tags for event IDs: {missing}")

    def sort_key(event: CanonicalEvent):
        tag = tags_by_event[event.id]
        days = tag.estimated_days_remaining
        return (
            _URGENCY_RANK[tag.urgency],
            days is not None,  # unknown freshness is checked first
            days if days is not None else 0.0,
            -event.quantity,
            event.item.casefold(),
            event.id,
        )

    ranked_events = sorted(inbound, key=sort_key)

    entries = []
    for rank, event in enumerate(ranked_events, start=1):
        tag = tags_by_event[event.id]
        entries.append(
            PriorityEntry(
                rank=rank,
                event_id=event.id,
                item=event.item,
                quantity=event.quantity,
                unit=event.unit,
                source_partner=event.source_partner,
                urgency=tag.urgency,
                estimated_days_remaining=tag.estimated_days_remaining,
            )
        )
    return entries
