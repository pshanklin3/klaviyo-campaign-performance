# Klaviyo Campaign Performance + Success Plan

Customer-facing account health (Performance + Success plan). Edit fields **on the same page** (password unlock → Save).

## URLs

| Page | Path |
| --- | --- |
| Account (view + edit) | `/c/hunter-trading` |
| Legacy admin URL | `/admin/hunter-trading` → redirects to account with Edit open |
| Legacy campaign table | `/` |
| Old mockup path | `/mockup` → redirects to account |

## How to edit

1. Open `/c/hunter-trading`
2. Click **Edit** (top right)
3. Enter CSM password (default locally: `klaviyo-csm`; set `CSM_ADMIN_PASSWORD` to override)
4. Change fields in place on the dashboard
5. Click **Save**

## Connect Klaviyo (SSO)

Use **Klaviyo MCP / SSO** (Claude Desktop, Claude Code, or Cursor) for live metrics. Do not create a private API key for normal use.

1. Authenticate the Klaviyo MCP integration in your agent.
2. Ask it to pull / refresh performance, then **POST** to `/api/customers/…/metrics/ingest` (see below), or commit `plan.json`.
3. Legacy campaign-table snapshot: `src/data/live-campaign-report.json` on `/`.

## Durable Save on Vercel

Local `npm run dev` writes `src/data/customers/*/plan.json`. On Vercel, Save uses **Vercel Blob**:

1. Project → **Storage** → **Create Database** → **Blob**
2. Check **Add a read-write token env var** (adds `BLOB_READ_WRITE_TOKEN`)
3. **Redeploy** so the token is live
4. Edit + Save on the account page — status should say Saved to Vercel Blob

## Experiment metric pulls (MCP / SSO)

Benchmark / current values are refreshed by an agent using **Klaviyo MCP** — not a private API key on Vercel.

### Option A — Claude → paste in the app (recommended for CSMs)

1. Connect **Klaviyo MCP** in Claude (SSO).
2. Ask Claude for metrics JSON only (no password):

```
Use Klaviyo MCP for hunter-trading / Drake Waterfowl.
GET https://YOUR-APP.vercel.app/api/customers/hunter-trading/metrics/ingest
for schema + experiment ids.
Pull last_30_days, prior 30d, L7, yesterday campaign + flow reports (Placed Order).
Compute overview + experiment before/after metrics.
Output ONLY the finished JSON body — do not POST, do not use passwords/tokens.
```

3. On the live site: **Edit** → unlock with CSM password → **Import metrics** → paste Claude’s JSON → **Apply metrics**.

Numbers update immediately (saved to Blob). No terminal.

### Option B — Metrics ingest API (curl / agents that may POST)

1. Connect **Klaviyo MCP** in Claude Desktop / Claude Code / Cursor (SSO).
2. Pull campaign + flow reports (Placed Order conversion metric).
3. POST the computed numbers (or paste via Option A):

```bash
# Schema + experiment ids
curl -s http://127.0.0.1:43147/api/customers/hunter-trading/metrics/ingest | jq .

# Ingest (CSM password — or METRICS_INGEST_TOKEN)
curl -s -X POST http://127.0.0.1:43147/api/customers/hunter-trading/metrics/ingest \
  -H "Content-Type: application/json" \
  -H "x-csm-admin-password: $CSM_ADMIN_PASSWORD" \
  -d @payload.json
```

Auth headers (any one):
- `x-csm-admin-password` — same as Edit/Save
- `x-metrics-ingest-token` or `Authorization: Bearer …` — set `METRICS_INGEST_TOKEN` in Vercel for agents

On Vercel, ingest writes **Blob** so the live page updates immediately.

### Option B — Commit `plan.json` (Cursor agent)

1. In Cursor: **“Refresh experiment metrics for hunter-trading”**
2. Agent updates `plan.json`, pushes
3. After deploy, the live app merges those metric fields over Blob

Each experiment needs `objectId` (flow message / campaign id) and `changedOn` for before/after windows.

| Field | Purpose |
| --- | --- |
| `scope` | flow message · flow · campaign · … |
| `objectId` | Klaviyo flow message / flow / campaign id (comma-separated OK for campaign aggregates) |
| `changedOn` + `benchmarkDays` | Before/after windows |
| `preset` / `goalMetricLabel` | What number to show (click rate, rev/recipient, …) |

### Claude prompt (copy/paste)

```
Connect to Klaviyo MCP. For Drake Waterfowl (hunter-trading):
1. GET /api/customers/hunter-trading/metrics/ingest on the live app for experiment ids + schema
2. Pull last_30_days (+ prior 30d) campaign and flow reports with Placed Order
3. Compute attributed totals, email/SMS share, campaign/flow share, and experiment before/after metrics
4. Output ONLY the finished JSON body — do not POST and do not use any password or token
The CSM will paste that JSON into the app (Edit → Import metrics → Apply).
```

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (production Save).
