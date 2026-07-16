"""FastAPI service exposing the Marathon Kitchen agent pipeline."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import storage
from connectors import read_all
from freshness import estimate_freshness
from briefing import generate_briefs
from graph import run_pipeline
from prioritization import prioritize
from schemas import CanonicalEvent
from translation import translate

app = FastAPI(title="Marathon Kitchen Coordination Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    source_partner: str
    raw: dict


def _recompute_from_stored_events() -> dict:
    """Re-run freshness -> prioritize -> brief over whatever is currently
    in the store (used after seeding or after a live ingest)."""
    events = [CanonicalEvent(**e) for e in storage.list_events()]
    tags = [estimate_freshness(e) for e in events]
    ranked = prioritize(events, tags)
    briefs = generate_briefs(ranked)
    storage.save_briefs([b.model_dump(mode="json") for b in briefs])
    return {"event_count": len(events), "brief_count": len(briefs)}


@app.get("/health")
def health():
    return {"status": "ok", "using_supabase": storage.using_supabase()}


@app.post("/demo/seed")
def seed_demo_data():
    """Load the mock partner files, run the full pipeline, persist results.
    This is the 'aha' demo step: three different raw formats in, one
    unified inventory + two partner briefs out."""
    raw_records = read_all()
    if not raw_records:
        raise HTTPException(500, "No mock partner data found")

    result = run_pipeline(raw_records)
    storage.insert_events([e.model_dump(mode="json") for e in result["events"]])
    storage.save_briefs([b.model_dump(mode="json") for b in result["briefs"]])

    return {
        "events_ingested": len(result["events"]),
        "by_source": {
            source: sum(1 for e in result["events"] if e.source_partner == source)
            for source in {s for s, _ in raw_records}
        },
        "briefs_generated": [b.partner_id for b in result["briefs"]],
    }


@app.post("/ingest")
def ingest(request: IngestRequest):
    """Translate and store a single live record, then refresh briefs."""
    event = translate(request.source_partner, request.raw)
    storage.insert_events([event.model_dump(mode="json")])
    summary = _recompute_from_stored_events()
    return {"event_id": event.id, **summary}


@app.post("/pipeline/refresh")
def refresh_pipeline():
    """Recompute freshness/priority/briefs from whatever is currently stored."""
    return _recompute_from_stored_events()


@app.get("/events")
def get_events():
    return storage.list_events()


@app.get("/briefs")
def get_briefs():
    return storage.list_briefs()


@app.get("/briefs/{partner_id}")
def get_brief(partner_id: str):
    briefs = {b["partner_id"]: b for b in storage.list_briefs()}
    if partner_id not in briefs:
        raise HTTPException(404, f"No brief for partner '{partner_id}'")
    return briefs[partner_id]
