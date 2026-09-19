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

## Connect Klaviyo (OAuth)

1. Create/configure the OAuth app in Klaviyo (**Manage apps**) — already done for **Dashboard**.
2. On Vercel → **Environment Variables** (Secret), add:
   - `KLAVIYO_CLIENT_ID` — from the OAuth app
   - `KLAVIYO_CLIENT_SECRET` — generate/copy once if needed
   - `CSM_ADMIN_PASSWORD` — if not already set
   - Redirect in the Klaviyo app must match:  
     `https://klaviyo-campaign-performance.vercel.app/api/klaviyo/oauth/callback`
3. **Redeploy**
4. On `/c/hunter-trading`: **Connect Klaviyo** → approve in Klaviyo → **Refresh metrics**

Tokens are stored in Blob per customer. No customer private API key.

## Durable Save on Vercel

Local `npm run dev` writes `src/data/customers/*/plan.json`. On Vercel, Save uses **Vercel Blob**:

1. Project → **Storage** → **Create Database** → **Blob**
2. Check **Add a read-write token env var** (adds `BLOB_READ_WRITE_TOKEN`)
3. **Redeploy** so the token is live
4. Edit + Save on the account page — status should say Saved to Vercel Blob

## Refresh metrics

1. **Connect Klaviyo** (once per account) — OAuth, no private API key  
2. **Refresh metrics** (or type `refresh metrics` → Go)

Fallback: ask Cursor with MCP to refresh if OAuth isn’t set up yet.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (production Save).
