"""Persistence layer.

Defaults to a local JSON file so the pipeline is runnable and demoable with
zero external credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the
environment to switch to Postgres persistence -- no other code changes
required, since every caller goes through the functions below.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"
LOCAL_STORE_PATH = DATA_DIR / "local_store.json"
_lock = threading.Lock()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_supabase_client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        from supabase import create_client

        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except ImportError:
        _supabase_client = None


def using_supabase() -> bool:
    return _supabase_client is not None


def _read_local() -> dict[str, list[dict]]:
    if not LOCAL_STORE_PATH.exists():
        return {"unified_inventory_events": [], "briefs": [], "outcomes": []}
    with open(LOCAL_STORE_PATH) as f:
        return json.load(f)


def _write_local(store: dict[str, list[dict]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with open(LOCAL_STORE_PATH, "w") as f:
        json.dump(store, f, indent=2, default=str)


def insert_events(events: list[dict[str, Any]]) -> None:
    if _supabase_client:
        _supabase_client.table("unified_inventory_events").upsert(events).execute()
        return
    with _lock:
        store = _read_local()
        existing_ids = {e["id"] for e in store["unified_inventory_events"]}
        for e in events:
            if e["id"] not in existing_ids:
                store["unified_inventory_events"].append(e)
        _write_local(store)


def list_events() -> list[dict[str, Any]]:
    if _supabase_client:
        res = _supabase_client.table("unified_inventory_events").select("*").execute()
        return res.data
    return _read_local()["unified_inventory_events"]


def save_briefs(briefs: list[dict[str, Any]]) -> None:
    if _supabase_client:
        _supabase_client.table("briefs").upsert(
            briefs, on_conflict="partner_id"
        ).execute()
        return
    with _lock:
        store = _read_local()
        by_partner = {b["partner_id"]: b for b in store["briefs"]}
        for b in briefs:
            by_partner[b["partner_id"]] = b
        store["briefs"] = list(by_partner.values())
        _write_local(store)


def list_briefs() -> list[dict[str, Any]]:
    if _supabase_client:
        res = _supabase_client.table("briefs").select("*").execute()
        return res.data
    return _read_local()["briefs"]


def reset_local_store() -> None:
    _write_local({"unified_inventory_events": [], "briefs": [], "outcomes": []})
