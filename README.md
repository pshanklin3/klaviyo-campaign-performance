# Klaviyo Campaign Performance

A Next.js dashboard that shows **Klaviyo campaign performance for the last 30 days** — recipients, open rate, click rate, conversions, and revenue.

Without an API key it loads realistic sample data so you can explore the UI immediately.

## Run locally

```bash
npm install
npm run dev -- --port 43147 --hostname 127.0.0.1
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

## Connect your Klaviyo account

1. In Klaviyo, create a **Private API Key** with at least `campaigns:read` and `metrics:read`.
2. Copy `.env.example` to `.env.local` and set:

```bash
KLAVIYO_PRIVATE_API_KEY=pk_your_key_here
```

3. Optionally set `KLAVIYO_CONVERSION_METRIC_ID` to your Placed Order metric ID. If omitted, the app resolves **Placed Order** (then Ordered Product / Checkout Started) from `GET /api/metrics/`.

4. Restart the dev server. The dashboard badge switches from **Sample data** to **Live Klaviyo data**.

## How it works

- `GET /api/campaigns` calls Klaviyo’s **Campaign Values Report** (`POST /api/campaign-values-reports/`) with `timeframe.key = last_30_days`.
- Campaign names and send times come from `GET /api/campaigns/`.
- On missing credentials or API errors, the route falls back to mock data and surfaces a clear banner.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
