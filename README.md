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

For **one-click Refresh** on the live site, add a read-only `KLAVIYO_PRIVATE_API_KEY` in Vercel (see below). That key never goes to Claude or the browser — only the server uses it.

Optional: Cursor / Claude can still use **Klaviyo MCP (SSO)** for ad-hoc pulls; the app’s primary customer path is the Refresh button.

## Durable Save on Vercel

Local `npm run dev` writes `src/data/customers/*/plan.json`. On Vercel, Save uses **Vercel Blob**:

1. Project → **Storage** → **Create Database** → **Blob**
2. Check **Add a read-write token env var** (adds `BLOB_READ_WRITE_TOKEN`)
3. **Redeploy** so the token is live
4. Edit + Save on the account page — status should say Saved to Vercel Blob

## Refresh metrics (one click)

On the account page: **Refresh metrics**, or type `refresh metrics` in **Ask the page** and hit Go.

That pulls live Account Overview + experiment cards from Klaviyo and saves to Blob.

**One-time Vercel setup** (Secret env vars, then Redeploy):

| Variable | Purpose |
| --- | --- |
| `CSM_ADMIN_PASSWORD` | Unlock Edit / authorize Refresh |
| `KLAVIYO_PRIVATE_API_KEY` | Read-only Klaviyo key so the button can pull Reporting data |
| `BLOB_READ_WRITE_TOKEN` | Already set if Blob store is connected |

Create the Klaviyo key: Klaviyo → **Settings** → **API keys** → Create Private Key (read access to metrics / reporting is enough).

Without the Klaviyo key, Refresh will show a clear setup hint. Claude MCP paste/import remains an optional fallback under Edit → Import JSON.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147/c/hunter-trading](http://127.0.0.1:43147/c/hunter-trading).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel Blob (production Save).
