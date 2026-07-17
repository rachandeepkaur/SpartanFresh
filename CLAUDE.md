# Marathon Kitchen Coordination Platform

Inventory automation that lets partner organizations report food inventory
in whatever format they already use, and unifies it into one accurate,
urgency-ranked picture — so a program manager isn't manually relaying
updates between upstream donors and downstream recipients. Full product
vision, actor table, and end-to-end example flow: [README.md](README.md).

This file tracks **what's actually built vs. what's still aspirational**,
for anyone (human or agent) picking up the next piece of work.

## Repo layout

```
agents/            FastAPI + LangGraph backend (the pipeline)
  main.py            HTTP routes
  graph.py            LangGraph StateGraph wiring the 4 stages below
  translation.py       stage 1: raw record -> canonical schema
  freshness.py          stage 2: expiry/shelf-life -> urgency tag
  prioritization.py      stage 3: rank every item on one urgency scale
  briefing.py              stage 4: ranked list -> partner-specific brief
  storage.py          persistence (local JSON, or Supabase if configured)
  schemas.py          canonical Pydantic models shared by every stage
  connectors/         one reader per partner's mock data format (3 total)
  mock_data/           the actual mock files those connectors read
  data/local_store.json  default persistence target (gitignored)
  routers/, prompts/   EMPTY — scaffolded in the suggested structure, unused
web/                Next.js 16 (App Router) + React 19 dashboard
  app/page.tsx         the dashboard (sidebar + topbar + live panels)
  lib/api.ts            typed fetch client for the FastAPI backend
  lib/dashboard.ts        derives all dashboard stats from raw events/briefs
  components/          Sidebar, Topbar, StatCard, InventorySnapshotPanel,
                        AlertsPanel, PartnerBreakdownPanel, ExpiringSoonPanel,
                        RecentUpdatesPanel, BriefCard, EventsTable, icons
docs/schema.sql     Postgres/Supabase schema mirroring schemas.py
```

## What's built

**Pipeline (agents/), all wired via `graph.py` as a LangGraph `StateGraph`:**

- **Translation** — 3 mock partner formats → canonical schema. Two
  (`spartan_garden` CSV, `community_donor` JSONL) use deterministic mapping
  tables. The third (`spartan_pantry_intake`, dynamic per-item JSON keys)
  falls back to a Gemini call, or a regex-based heuristic mimicking it when
  no `GEMINI_API_KEY` is set — **no key is currently configured**, so this
  path runs on the heuristic today.
- **Freshness** — expiry-date math where a date exists (high confidence);
  otherwise a hand-written shelf-life table by item/category (medium
  confidence). The vision-based "photo of produce condition" path described
  in the README is not implemented — the shelf-life table is its offline
  stand-in.
- **Prioritization** — single urgency ranking (critical/use_soon/normal/low)
  across every category and partner, ties broken by quantity.
- **Briefing** — 2 hardcoded partner briefs: `marathon_kitchen_internal`
  (everything) and `spartan_pantry` (critical + use_soon only). Narrative
  text is template-based by default, Gemini-phrased if a key is configured.
- **Storage** — local JSON file by default; switches to Supabase with zero
  code changes if `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are set. Schema for
  the Postgres path exists in `docs/schema.sql` (includes an `outcomes`
  table — see below).
- **API** (`main.py`) — `/health`, `/demo/seed`, `/ingest` (single live
  record), `/uploads` (spreadsheet upload, see below), `/pipeline/refresh`,
  `/events`, `/briefs`, `/briefs/{partner_id}`.
- **Spreadsheet upload** (`translate_upload_row` in `translation.py`,
  `POST /uploads` in `main.py`) — a program manager attaches a partner's own
  `.csv`/`.xlsx` from the dashboard, tagged with which organization it's
  from (an existing partner id, or a free-typed new one — onboarding a new
  org needs no code change). Columns are matched loosely by alias (item/
  name/crop, quantity/qty, unit, category, expiry date/ready date, …), each
  row is translated independently, and bad rows are reported back per-row
  instead of failing the whole file. This is the practical, human-in-the-
  loop stand-in for the "live connectors" gap below — see that item for
  what it still isn't.

**Frontend (web/):**

- Full dashboard redesign: sidebar nav, topbar (date, alerts, refresh,
  upload), 4 stat cards, category donut chart, critical-alerts panel,
  top-sources / downstream-recipients breakdowns, expiring-soon list,
  recent-activity feed, full inventory table, partner brief cards.
- Every number is derived from real `/events` + `/briefs` data (see
  `lib/dashboard.ts`) — nothing on the dashboard is fabricated.
- **"Upload update"** button in the topbar (`UploadPanel.tsx`) posts a
  spreadsheet to `/uploads` and shows per-row results (rows added / rows
  skipped + why) inline.
- No polling. Data loads once on mount and re-loads only on a real
  triggering action — manual refresh, "Seed demo data," or a successful
  upload — since polling a backend that only changes when a human acts on
  it was simulating liveness that wasn't there. Liveness that *is* real:
  a 1s ticker keeps "Xs/m/h ago" timestamps and the freshness indicator
  moving, and the topbar bell badge pulses (`animate-ping`) when a refresh
  surfaces a genuinely higher alert count (suppressed on the initial load).
  This pulse logic lives in `app/page.tsx`, not `AlertsPanel.tsx` — alert
  derivation itself (`deriveAlerts` in `lib/dashboard.ts`) is untouched.
- Sidebar nav items with no backing feature (Forecast & Planning, Data
  Mappings, Tasks, Reports, Partners, Users & Roles, Settings) are rendered
  disabled/grayed rather than as dead links.

## What's NOT built yet

Ordered roughly by what would matter most for the "facilitate
communication between organizations" goal:

1. **Live connectors.** All 3 seeded connectors still read static files in
   `mock_data/`. The dashboard's spreadsheet upload (above) covers the
   *manual* case — a person exports/attaches a file — but the README's
   original plan (Google Sheets API / form webhooks per partner, pushing
   data in automatically with no human step) doesn't exist. `POST /ingest`
   (single record) also still has nothing calling it automatically.
2. **Outcome feedback loop.** `docs/schema.sql` defines an `outcomes` table
   (what a partner actually used/received) but there's no API route or UI
   to log or read outcomes, and nothing feeds them back into anything.
3. **Forecast agent.** Named in the pipeline diagram and tech stack in the
   README as a stretch goal; no `forecast.py` or equivalent exists. Nothing
   predicts inbound volume/mix from history.
4. **Brief delivery.** Briefs are generated and stored, but nothing pushes
   them anywhere partners already check (group chat, print view, etc.) —
   they're only readable via the dashboard or `GET /briefs/{partner_id}`.
5. **More than 2 briefs / partner-scoped auth.** Only
   `marathon_kitchen_internal` and `spartan_pantry` are generated; "other
   partner org" and "household/direct" briefs from the README's actor
   table don't exist. There's also no login/auth — the dashboard's "Program
   Manager" user badge is a static placeholder, not a real session.
6. **Outbound/distribution tracking.** `CanonicalEvent.direction` supports
   `"outbound"`, but nothing in the pipeline ever produces one — every
   mock record is inbound. The dashboard's "Distributed" stat and
   "Downstream Recipients" panel are structurally ready but currently
   always show 0 / brief-derived proxies, not real distribution data.
7. **Supabase path is unverified.** The local-JSON fallback is what's
   actually been run; `docs/schema.sql` and the Supabase branch of
   `storage.py` exist but haven't been exercised against a real project in
   this environment.
8. **`agents/routers/` and `agents/prompts/`** are empty directories from
   the suggested repo structure — all routes currently live directly in
   `main.py`, and all prompts live inline in `translation.py`/`briefing.py`.

## Running it

```bash
# Backend
cd agents && source .venv/bin/activate   # venv + deps already present
uvicorn main:app --reload --port 8000

# Frontend
cd web && npm run dev   # http://localhost:3000, expects backend on :8000
```

Then `POST http://localhost:8000/demo/seed` (or the dashboard's "Seed demo
data" button) to load the 3 mock partner files through the full pipeline.
No API keys are required for any of this — see "What's built" above for
exactly which paths run on heuristics instead of Gemini as a result.

## Gotchas worth knowing before touching this repo

- `web/AGENTS.md` warns this is Next.js 16 / React 19 with real breaking
  changes from training-data-era Next.js — check
  `web/node_modules/next/dist/docs/` before assuming an API works the way
  you remember.
- `web/eslint.config.mjs` enables the React Compiler's strict hook rules
  (`react-hooks/set-state-in-effect`, `react-hooks/immutability`, etc.).
  Calling `setState` synchronously in a `useEffect` body (even via a
  helper function) or mutating a closed-over `let` across a `.map()` both
  fail lint — see `app/page.tsx`'s load-on-mount/bell-pulse effects (both
  defer their `setState` a tick via `setTimeout`) and
  `InventorySnapshotPanel.tsx`'s donut-arc math for the patterns that
  satisfy it.
- Partner quantities are **not unit-comparable** — lbs, cans, gallons,
  loaves, dozens, etc. all coexist. Dashboard totals sum raw quantity
  labeled generically as "units"; don't present them as if they were a
  single physical unit like lbs.
- `KNOWN_PARTNER_IDS` in `web/app/page.tsx` is hardcoded from
  `agents/connectors/__init__.py`'s `CONNECTORS` dict (it seeds both the
  "configured partner count" stat and the upload panel's dropdown) — update
  both together if a partner connector is added or removed. Uploads under a
  new, free-typed organization name work regardless and are folded into the
  "partners reporting" count automatically.
