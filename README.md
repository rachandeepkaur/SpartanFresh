# Marathon Kitchen Coordination Platform

*Working title — rename freely (candidates: KitchenLink, HarvestLink, SpartanFresh Network).*

## 1. What this is

Marathon Kitchen is a hub, not a single pantry. It **receives** donations from
multiple upstream sources (Spartan Garden, individual/community donors, food
drives) and **distributes** to multiple downstream recipients — Spartan Food
Pantry, other partner organizations, and households directly.

Every one of those upstream and downstream partners tracks inventory
differently: different spreadsheets, different field names, different units.
Today that mismatch is bridged manually — someone re-types numbers from one
partner's format into another's, or a program manager relays updates by hand
between teams as the operation grows past what word-of-mouth can handle.

This project automates two things:
1. **Interoperability** — translating every partner's inventory format into
   one shared schema, so the system has a single accurate picture regardless
   of who reported what, in what shape.
2. **Freshness & coordination** — using that unified picture to flag what's
   expiring, forecast what's coming, and brief each team on only what's
   relevant to them.

It does **not** automate receiving decisions, packing decisions, planting
decisions, or the actual handoff of food to people. Those stay human.

## 2. Who this is for

| Actor | Relationship to Marathon Kitchen | What they need from this system |
|---|---|---|
| Upstream donors (Spartan Garden, community donors, food drives) | Send food in | A low-friction way to log what's coming/arrived, in whatever format they already use |
| Marathon Kitchen intake/processing staff | Receive & process everything | One unified view of all inbound inventory, freshness-tagged |
| Spartan Food Pantry | Receives distributed food | A brief on what's being sent, when, and its urgency/shelf life |
| Other partner orgs & households | Receive distributed food | Same as above, scoped to what they receive |
| Marathon Kitchen program manager | Oversees the whole flow | Visibility across every partner without manually relaying updates |

## 3. Core idea: the translation layer

Different partners report the same item differently. Example:

```
Partner A (Spartan Garden sheet):
  Crop, Lbs_Ready, Ready_Date
  Tomatoes, 30, 2026-07-20

Partner B (community donor form):
  {"item_scanned": "canned_beans", "qty": 50, "expiry": "2026-09-01"}

Partner C (Spartan Pantry intake log):
  {"beans_cans_available": 50, "date": "2026-07-16"}
```

The translation agent maps all of these onto one canonical event shape:

```json
{
  "item": "Canned Beans",
  "quantity": 50,
  "unit": "cans",
  "category": "canned",
  "source_partner": "spartan_pantry_intake",
  "direction": "inbound",
  "timestamp": "2026-07-16T14:00:00"
}
```

Known, stable partner formats get a deterministic mapping table (fast, free,
no model call). Unfamiliar or changed formats fall back to a Gemini call that
maps fields onto the canonical schema. Every event, regardless of source,
ends up in one table: `unified_inventory_events`.

## 4. Agent pipeline

```
Upstream sources (garden, donors, drives)
        |
        v
[Ingestion connectors]  -- one per partner format, reads what already exists
        |
        v
[Translation agent]  -- normalizes into canonical schema
        |
        v
[Unified inventory store]  (Supabase / Postgres)
        |
        v
[Forecast agent]  -- predicts inbound volume & mix from history
        |
[Freshness agent]  -- tags condition/expiry on newly logged items
        |
        v
[Prioritization agent]  -- ranks all items by urgency, across all partners
        |
        v
[Briefing agent]  -- turns one priority list into partner-specific briefs
        |
        +--> Spartan Pantry brief
        +--> Other partner org brief
        +--> Household/direct-distribution brief
        +--> Marathon Kitchen internal brief (intake + processing)
        |
        v
[Outcomes logged]  -- what each partner actually used/received
        |
        v (feedback loop, dashed)
[Forecast agent]  -- refines next cycle's predictions
```

### Agent responsibilities

**Translation agent**
- Input: raw record from any connector, in its native format
- Output: one canonical event (see schema above)
- Logic: check deterministic mapping table first; only call Gemini for
  unrecognized shapes

**Forecast agent**
- Input: unified store, filtered to inbound events over time
- Output: predicted volume/mix for the coming 1-2 weeks per source
- Purpose: let Marathon Kitchen plan processing capacity before food arrives,
  not just react to it

**Freshness agent**
- Input: newly logged inbound item (photo for produce, printed date for
  packaged/canned/frozen/milk)
- Output: `{item, estimated_days_remaining, confidence}`
- Logic: OCR for anything with a printed date; Gemini vision classification
  (fresh / use soon / spoiling) for produce with no printed date

**Prioritization agent**
- Input: all currently-held inventory with freshness tags
- Output: ranked urgency list across every category and every partner, on one
  comparable scale

**Briefing agent**
- Input: prioritization output + which partner needs which slice
- Output: a short, partner-specific brief -- not a shared dashboard everyone
  has to parse themselves
- Delivery: pushed to wherever each partner already checks in (existing group
  chat, printed sheet, simple web view) -- never a new tool nobody asked for

## 5. Example end-to-end flow

1. Spartan Garden logs 30 lbs of tomatoes ready in 4 days (their own sheet,
   untouched).
2. A community donor drops off 50 cans of beans; Marathon Kitchen intake
   scans/photographs them, expiry OCR'd as 2026-09-01.
3. Translation agent normalizes both into canonical events, written to
   `unified_inventory_events`.
4. Freshness agent tags the tomatoes as "use soon" (short shelf life, no
   printed date) and the beans as low urgency (long shelf life).
5. Prioritization agent ranks the tomatoes above the beans.
6. Briefing agent generates:
   - Marathon Kitchen internal brief: "Tomatoes arriving in 4 days -- plan
     processing/distribution before they turn."
   - Spartan Pantry brief: "Expect ~30 lbs tomatoes this week, distribute
     promptly."
7. Spartan Pantry distributes the tomatoes; staff log what was
   used/leftover.
8. That outcome logs back through the translation layer, feeding the
   forecast agent for next season's tomato planning.

## 6. What's automated vs. manual

**Automated:**
- Reformatting each partner's data into one shared schema
- Reading expiry dates (OCR) and produce condition (vision)
- Ranking urgency across every category and partner on one scale
- Forecasting inbound volume/mix from history
- Turning one priority list into separate, partner-specific briefs
- Feeding outcomes back to improve future forecasts

**Stays manual:**
- The photo/scan or form entry at the point of donation/intake
- The frozen-food "still solid vs. thawed" judgment
- Deciding what to plant, what to accept, how to pack, and how to distribute
- Reading a brief and acting on it -- the system informs, it doesn't decide

## 7. Tech stack

- **Frontend:** Next.js 14 (App Router), Tailwind, deployed on Vercel
- **Agents/orchestration:** LangGraph + FastAPI, deployed on Railway/Render
- **Model (for future):** Fine-tune on the mq3 dataset to handle both the
  freshness tagging and the translation-agent fallback for unrecognized
  formats. Until that exists, both fall back to Gemini API calls.
- **Database:** Supabase (Postgres) -- `unified_inventory_events`,
  `partners`, `briefs`, `outcomes` tables
- **Connectors:** Google Sheets API / form webhooks per partner source, kept
  as thin adapters so a new partner = one new adapter, not a schema change

## 8. Suggested repo structure

```
marathon-kitchen-platform/
├── web/                    # Next.js frontend
│   ├── app/
│   └── components/
├── agents/                 # FastAPI + LangGraph service
│   ├── graph.py            # pipeline: translate -> forecast/freshness -> prioritize -> brief
│   ├── main.py
│   ├── connectors/         # one adapter per partner data source
│   └── prompts/            # Gemini prompts (translation, freshness, briefing)
├── docs/                   # pitch materials, theme mapping, partner interview notes
└── README.md
```

## 9. MVP scope (hackathon build order)

1. Translation agent -- 2-3 mock partner formats to canonical schema (the
   demo "aha" moment)
2. Freshness agent -- OCR path for packaged goods first, vision check for
   produce as stretch
3. Prioritization agent -- simple urgency ranking
4. Briefing agent -- at least two partner-specific briefs (Marathon Kitchen
   internal + Spartan Pantry)
5. Dashboard -- one view showing the unified, translated inventory updating
   live
6. Forecast agent + feedback loop -- stretch goal if time allows

Seed data, don't build live connectors, for the demo: hand-write 10-20
records per mock partner format so the translation step has something real
to show on stage.

## 10. Getting started

See [agents/README.md](agents/README.md) for the backend service and
[web/README.md](web/README.md) for the frontend. Quick start:

```bash
# Backend (FastAPI + pipeline)
cd agents
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in GEMINI_API_KEY; Supabase vars optional
uvicorn main:app --reload --port 8000

# Frontend (Next.js dashboard)
cd web
npm install
npm run dev
```

Without Supabase credentials, the backend persists to a local JSON file
(`agents/data/local_store.json`) so the full pipeline is runnable and
demoable offline. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in
`agents/.env` to switch to Postgres persistence — no code changes required.
