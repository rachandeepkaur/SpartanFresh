# agents/ -- FastAPI + LangGraph pipeline

Implements the translate -> freshness -> prioritize -> brief pipeline
described in the root [README](../README.md).

## Run it

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # GEMINI_API_KEY optional, Supabase vars optional
uvicorn main:app --reload --port 8000
```

Without `GEMINI_API_KEY`, the translation agent's fallback path
(pantry intake's dynamic-key format) and brief narration both use
deterministic/heuristic logic instead of a Gemini call -- the pipeline
still runs end to end.

Without `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`, events and briefs persist
to `data/local_store.json` instead of Postgres.

## Try the demo flow

```bash
curl -X POST localhost:8000/demo/seed   # loads mock_data/, runs the pipeline
curl localhost:8000/events              # unified inventory, all 3 source formats
curl localhost:8000/briefs              # both partner briefs
curl localhost:8000/briefs/spartan_pantry
```

## Layout

- `schemas.py` -- canonical Pydantic models shared by every stage
- `connectors/` -- one reader per partner's mock data format
- `translation.py` -- deterministic mappers + Gemini/heuristic fallback
- `freshness.py` -- expiry-date math + shelf-life table
- `prioritization.py` -- urgency ranking across all partners
- `briefing.py` -- partner-specific brief generation
- `graph.py` -- wires the four stages as a LangGraph `StateGraph`
- `storage.py` -- local JSON now, Supabase when credentials are set
- `main.py` -- FastAPI routes
