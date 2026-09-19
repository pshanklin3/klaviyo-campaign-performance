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

## Connect Klaviyo

Use **Klaviyo MCP / SSO in Cursor** to refresh live metrics. Do **not** store the customer’s private API key in Vercel.

## Durable Save on Vercel

Local `npm run dev` writes `src/data/customers/*/plan.json`. On Vercel, Save uses **Vercel Blob**:

1. Project → **Storage** → **Create Database** → **Blob**
2. Check **Add a read-write token env var** (adds `BLOB_READ_WRITE_TOKEN`)
3. **Redeploy** so the token is live
4. Edit + Save on the account page — status should say Saved to Vercel Blob

## Refresh metrics

**Do not put the customer’s Klaviyo private API key in Vercel.**

CSMs refresh live numbers through **Cursor + Klaviyo MCP (SSO)**:

1. In Cursor on this project, say: **Refresh Drake metrics for hunter-trading**
2. The agent pulls Account Overview + experiments via MCP and updates `plan.json` (and Blob when available)
3. After deploy / Blob save, `/c/hunter-trading` shows the new numbers

The **Refresh metrics** button / “Ask the page” prompt on the site will say the same if no server-side Klaviyo connection is configured.

Optional later: Klaviyo **OAuth Connect** in the app (customer authorizes once) so Refresh works in-browser without a private key.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (production Save).
