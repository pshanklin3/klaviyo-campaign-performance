# Klaviyo Campaign Performance + Success Plan

Customer-facing account health (Performance + Success plan) with a **CSM admin** editor for goals, experiments, meetings, tasks, and tickets.

## URLs

| Page | Path |
| --- | --- |
| Customer view | `/c/hunter-trading` |
| CSM admin | `/admin/hunter-trading` |
| Legacy campaign table | `/` |
| Old mockup path | `/mockup` → redirects to customer view |

## Connect Klaviyo (SSO)

Use **Klaviyo SSO through Cursor** for pulling live campaign metrics into snapshots. Do not create a private API key for normal use.

1. Authenticate the Klaviyo integration in Cursor.
2. Ask the agent to pull / refresh campaign performance.
3. Snapshot lands in `src/data/live-campaign-report.json` (campaign table on `/`).

## CSM admin (manual plan data)

Edit experiments, goals, meetings, tasks, product requests, and Zendesk rows at `/admin/hunter-trading`.

- Default password (local): `klaviyo-csm`
- Override with `CSM_ADMIN_PASSWORD` in `.env.local`
- Data file: `src/data/customers/hunter-trading/plan.json`

**Persistence note:** Saving writes that JSON file. That works with `npm run dev`. On Vercel the filesystem is usually read-only — use **Copy JSON** in admin, paste into `plan.json`, commit, and redeploy. (A database can replace the file store later.)

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading) and [http://127.0.0.1:43147/admin/hunter-trading](http://127.0.0.1:43147/admin/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
