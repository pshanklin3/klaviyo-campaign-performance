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
- Seed / git mirror: `src/data/customers/hunter-trading/plan.json`

### Durable Save on Vercel

Local `npm run dev` writes `plan.json` on disk. On Vercel the filesystem is read-only, so production Save uses **Vercel Blob**:

1. In the Vercel project → **Storage** → **Create Blob Store** (connect to this project).
2. That adds `BLOB_READ_WRITE_TOKEN` to the project env automatically.
3. **Redeploy** so the new env is live.
4. Save again on `/admin/hunter-trading` — admin should show storage **Vercel Blob**.

Without the token, Save fails on Vercel with a setup hint. **Copy JSON** remains available as a backup.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading) and [http://127.0.0.1:43147/admin/hunter-trading](http://127.0.0.1:43147/admin/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (optional for production Save).
