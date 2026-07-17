# Deployment

This is a two-part app and the parts deploy to two different places:

| Part      | Directory | Platform                    | Why                                              |
| --------- | --------- | --------------------------- | ------------------------------------------------ |
| Frontend  | `web/`    | **Vercel**                  | Native Next.js host, zero-config.                |
| Backend   | `agents/` | **Render** (or Railway/Fly) | Long-running FastAPI process that writes to disk.|

> **Deploy the backend first.** The frontend needs the backend's public URL
> at build time (`NEXT_PUBLIC_API_URL`), and the backend needs the
> frontend's URL for CORS (`ALLOWED_ORIGINS`). Deploy backend → grab its
> URL → deploy frontend → copy frontend URL back into the backend's
> `ALLOWED_ORIGINS`.

---

## 1. Backend — FastAPI on Render

The backend can't run on Vercel: it's a stateful, long-running process that
writes to a JSON file on disk (and optionally talks to Supabase). Any
container host works — a `Dockerfile` is provided so the same image runs on
Render, Railway, Fly.io, or Cloud Run. Steps below use **Render** (free tier).

### Files added for this

- [`agents/Dockerfile`](agents/Dockerfile) — portable image, honors `$PORT`.
- [`agents/.dockerignore`](agents/.dockerignore) — keeps venv/data out of the build.
- [`render.yaml`](render.yaml) — Render blueprint (one-click infra).

### Steps (Render Blueprint)

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com): **New → Blueprint**,
   select this repo. Render reads [`render.yaml`](render.yaml) and creates a
   Docker web service named `spartanfresh-api`.
3. Set environment variables (all optional except CORS — see the table below).
   Leave `ALLOWED_ORIGINS` blank for now; fill it in after step 3 of the
   frontend deploy.
4. Deploy. When it's live, note the URL, e.g.
   `https://spartanfresh-api.onrender.com`.
5. Verify: open `https://<your-backend>/health` → `{"status":"ok", ...}`.
6. Seed data: `POST https://<your-backend>/demo/seed` (or use the "Seed demo
   data" button in the deployed dashboard).

### Steps (Railway or Fly.io instead)

Same `Dockerfile`, no `render.yaml` needed:

- **Railway** — New Project → Deploy from GitHub → set **Root Directory** to
  `agents`. Railway auto-detects the Dockerfile. Add the env vars below.
- **Fly.io** — from `agents/`: `fly launch --dockerfile Dockerfile`
  (decline the "overwrite Dockerfile" prompt), then
  `fly secrets set ALLOWED_ORIGINS=... GEMINI_API_KEY=...`, then `fly deploy`.

### Backend environment variables

| Variable              | Required | Purpose                                                                 |
| --------------------- | -------- | ----------------------------------------------------------------------- |
| `ALLOWED_ORIGINS`     | **Yes**  | Comma-separated frontend origins for CORS, e.g. `https://spartanfresh.vercel.app`. `*` allows all (fine for a demo). |
| `GEMINI_API_KEY`      | No       | Enables the Gemini translation/briefing paths; without it, heuristics run. |
| `GEMINI_MODEL`        | No       | Defaults to `gemini-flash-latest`.                                      |
| `SUPABASE_URL`        | No       | Switch persistence from local JSON to Supabase (see note below).        |
| `SUPABASE_SERVICE_KEY`| No       | Paired with `SUPABASE_URL`.                                             |

> **Persistence note.** By default the backend writes to
> `agents/data/local_store.json` on the container's **ephemeral** disk — it's
> wiped on every redeploy/restart. For a demo that's fine (just re-run
> `/demo/seed`). For durable data, set the Supabase variables, or attach a
> persistent disk mounted at `/app/data` (Render paid plans / Fly volumes).

---

## 2. Frontend — Next.js on Vercel

### Files added for this

- [`web/vercel.json`](web/vercel.json) — pins the Next.js framework preset.

### Steps

1. In [Vercel](https://vercel.com): **Add New → Project**, import this repo.
2. **Set the Root Directory to `web`** (Vercel setting → *Root Directory* →
   `web`). This is the one manual step that matters — the app lives in a
   subdirectory, not the repo root. Vercel then auto-detects Next.js, and
   `next build` / `npm install` come from [`web/vercel.json`](web/vercel.json).
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = your backend URL from step 4 above
     (e.g. `https://spartanfresh-api.onrender.com`, **no trailing slash**).
   - Set it for Production (and Preview if you want preview deploys to hit
     the same backend).
4. Deploy. Note the resulting URL, e.g. `https://spartanfresh.vercel.app`.
5. **Close the CORS loop:** go back to the backend's `ALLOWED_ORIGINS` env
   var, set it to the Vercel URL from step 4, and redeploy the backend.

> `NEXT_PUBLIC_API_URL` is inlined into the client bundle **at build time**
> (see [`web/lib/api.ts`](web/lib/api.ts)). If you change it, you must
> redeploy the frontend for the new value to take effect.

---

## Quick checklist

- [ ] Backend deployed, `/health` returns ok
- [ ] Backend `ALLOWED_ORIGINS` = the Vercel URL (redeployed after setting)
- [ ] Frontend Root Directory = `web`
- [ ] Frontend `NEXT_PUBLIC_API_URL` = the backend URL (no trailing slash)
- [ ] Open the dashboard, click **Seed demo data**, confirm panels populate
