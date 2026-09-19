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

Use **Klaviyo SSO through Cursor** for pulling live campaign metrics into snapshots. Do not create a private API key for normal use.

1. Authenticate the Klaviyo integration in Cursor.
2. Ask the agent to pull / refresh campaign performance.
3. Snapshot lands in `src/data/live-campaign-report.json` (campaign table on `/`).

## Durable Save on Vercel

Local `npm run dev` writes `src/data/customers/*/plan.json`. On Vercel, Save uses **Vercel Blob**:

1. Project → **Storage** → **Create Database** → **Blob**
2. Check **Add a read-write token env var** (adds `BLOB_READ_WRITE_TOKEN`)
3. **Redeploy** so the token is live
4. Edit + Save on the account page — status should say Saved to Vercel Blob

## Experiment metric pulls

Each experiment stores **what changed** plus a flexible **goal metric**:

| Field | Purpose |
| --- | --- |
| `scope` | flow message · flow · campaign · form · segment · list · account · custom |
| `preset` | Optional shortcut (click rate, …) or `custom` |
| `goalMetricLabel` | What shows on the card |
| `metrics[]` | One or more Klaviyo metrics (label + optional metric id) |
| `combine` | single · sum · average · ratio · custom formula |
| `objectId` | Klaviyo object id for the subject |
| `changedOn` + `benchmarkDays` | Before/after windows |

Any specific metric or aggregate of metrics can be an experiment goal — presets are shortcuts only. Benchmark / current values are display caches filled by pull later.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (production Save).
