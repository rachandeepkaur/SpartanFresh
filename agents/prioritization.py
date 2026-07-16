"""Prioritization agent: ranks every currently-held item by urgency, on one
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
    tags_by_event = {tag.event_id: tag for tag in freshness_tags}
    inbound = [e for e in events if e.direction == "inbound"]

    def sort_key(event: CanonicalEvent):
        tag = tags_by_event[event.id]
        days = tag.estimated_days_remaining
        return (
            _URGENCY_RANK[tag.urgency],
            days if days is not None else float("-inf"),
            -event.quantity,
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
