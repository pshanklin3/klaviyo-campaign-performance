# Klaviyo Campaign Performance

A Next.js dashboard that shows **Klaviyo campaign performance for the last 30 days** — recipients, open rate, click rate, conversions, and revenue.

## Connect your Klaviyo account (SSO)

Use **Klaviyo SSO through Cursor** — do not create or paste a private API key for normal use.

1. In this Cursor agent chat, connect / authenticate the **Klaviyo** integration (SSO sign-in to your Klaviyo account).
2. Ask the agent to pull campaign performance (for example: “pull last 30 days of campaign performance”).
3. The agent syncs a live snapshot into the app. The dashboard badge shows **Live Klaviyo data** for your account.

Conversion reporting uses your account’s **Placed Order** metric (via the authenticated Klaviyo session).

## Run locally

```bash
npm install
npm run dev -- --port 43147 --hostname 127.0.0.1
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

If no SSO-synced snapshot is present yet, the UI shows sample data until you authenticate Klaviyo in Cursor and pull a report.

## How it works

- Live data comes from Klaviyo’s campaign values reporting (last 30 days), loaded through the authenticated Cursor ↔ Klaviyo connection.
- `GET /api/campaigns` serves the synced snapshot (or sample data before SSO sync).
- Optional private API key env vars remain only as a non-SSO fallback for advanced local setups — prefer SSO.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
