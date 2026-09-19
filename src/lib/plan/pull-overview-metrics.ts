import {
  aggregateStatistics,
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
  hasKlaviyoApiKey,
  type CampaignReportRow,
  type FlowReportRow,
  type ReportStatistics,
} from "@/lib/klaviyo/reporting";
import type { CustomerPlan, OverviewMetric, PeriodRow } from "@/lib/plan/types";

function sumConversion(rows: { statistics: ReportStatistics }[]): number {
  return rows.reduce(
    (sum, row) => sum + (row.statistics.conversion_value ?? 0),
    0,
  );
}

function byChannel(
  rows: (CampaignReportRow | FlowReportRow)[],
): { email: number; sms: number; other: number } {
  const out = { email: 0, sms: 0, other: 0 };
  for (const row of rows) {
    const ch = row.groupings.send_channel ?? "other";
    const value = row.statistics.conversion_value ?? 0;
    if (ch === "email") out.email += value;
    else if (ch === "sms") out.sms += value;
    else out.other += value;
  }
  return out;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m.toFixed(m >= 10 ? 1 : 2)}M`;
  }
  if (abs >= 10_000) return `$${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function pctDelta(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Number((((current - prior) / Math.abs(prior)) * 100).toFixed(1));
}

function metric(
  label: string,
  value: number,
  prior: number,
): OverviewMetric {
  return {
    label,
    value: formatMoney(value),
    priorDeltaPct: pctDelta(value, prior),
    yoyDeltaPct: 0,
  };
}

async function attributedFor(
  conversionMetricId: string,
  timeframe: { key: string } | { start: string; end: string },
): Promise<{
  total: number;
  email: number;
  sms: number;
  campaign: number;
  flow: number;
}> {
  const [campaigns, flows] = await Promise.all([
    fetchCampaignValuesReport({ conversionMetricId, timeframe }),
    fetchFlowValuesReport({ conversionMetricId, timeframe }),
  ]);
  const camp = sumConversion(campaigns);
  const flow = sumConversion(flows);
  const campCh = byChannel(campaigns);
  const flowCh = byChannel(flows);
  return {
    total: camp + flow,
    email: campCh.email + flowCh.email,
    sms: campCh.sms + flowCh.sms,
    campaign: camp,
    flow,
  };
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pull Account Overview attributed metrics from Klaviyo Reporting API. */
export async function pullOverviewMetrics(plan: CustomerPlan): Promise<{
  overview: CustomerPlan["overview"];
  periods: PeriodRow[];
  callout: string;
}> {
  if (!hasKlaviyoApiKey()) {
    throw new Error(
      "Add KLAVIYO_PRIVATE_API_KEY in Vercel (Secret) for one-click refresh.",
    );
  }

  const conversionMetricId = await findConversionMetricId();
  const now = new Date();

  // Same weekday last week for yesterday prior (UTC day windows).
  const yday = new Date(now);
  yday.setUTCDate(yday.getUTCDate() - 1);
  const ydayPrior = new Date(yday);
  ydayPrior.setUTCDate(ydayPrior.getUTCDate() - 7);

  const priorL7End = new Date(now);
  priorL7End.setUTCDate(priorL7End.getUTCDate() - 7);
  const priorL7Start = new Date(priorL7End);
  priorL7Start.setUTCDate(priorL7Start.getUTCDate() - 7);

  const priorL30End = new Date(now);
  priorL30End.setUTCDate(priorL30End.getUTCDate() - 30);
  const priorL30Start = new Date(priorL30End);
  priorL30Start.setUTCDate(priorL30Start.getUTCDate() - 30);

  const mtdStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const priorMtdEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59),
  );
  const priorMtdStart = new Date(
    Date.UTC(priorMtdEnd.getUTCFullYear(), priorMtdEnd.getUTCMonth(), 1),
  );
  const dayOfMonth = now.getUTCDate();
  const priorMtdSameDay = new Date(
    Date.UTC(
      priorMtdStart.getUTCFullYear(),
      priorMtdStart.getUTCMonth(),
      Math.min(dayOfMonth, priorMtdEnd.getUTCDate()),
    ),
  );

  const [
    l30,
    prior30,
    l7,
    prior7,
    yesterday,
    ydayWeekAgo,
    mtd,
    priorMtd,
  ] = await Promise.all([
    attributedFor(conversionMetricId, { key: "last_30_days" }),
    attributedFor(conversionMetricId, {
      start: `${isoDay(priorL30Start)}T00:00:00Z`,
      end: `${isoDay(priorL30End)}T00:00:00Z`,
    }),
    attributedFor(conversionMetricId, { key: "last_7_days" }),
    attributedFor(conversionMetricId, {
      start: `${isoDay(priorL7Start)}T00:00:00Z`,
      end: `${isoDay(priorL7End)}T00:00:00Z`,
    }),
    attributedFor(conversionMetricId, { key: "yesterday" }),
    attributedFor(conversionMetricId, {
      start: `${isoDay(ydayPrior)}T00:00:00Z`,
      end: `${isoDay(yday)}T00:00:00Z`,
    }),
    attributedFor(conversionMetricId, { key: "this_month" }),
    attributedFor(conversionMetricId, {
      start: `${isoDay(priorMtdStart)}T00:00:00Z`,
      end: `${isoDay(priorMtdSameDay)}T00:00:00Z`,
    }),
  ]);

  const emailShare =
    l30.total > 0 ? Math.round((l30.email / l30.total) * 100) : 50;
  const campaignShare =
    l30.total > 0 ? Math.round((l30.campaign / l30.total) * 100) : 50;
  const smsShare = 100 - emailShare;
  const flowShare = 100 - campaignShare;

  const overview: CustomerPlan["overview"] = {
    ecomL30: {
      ...plan.overview.ecomL30,
      value: "—",
      priorDeltaPct: 0,
      yoyDeltaPct: 0,
      label: "Ecom revenue · last 30 days (not in Klaviyo)",
    },
    ecomYesterday: {
      ...plan.overview.ecomYesterday,
      value: "—",
      priorDeltaPct: 0,
      yoyDeltaPct: 0,
      label: "Ecom revenue · yesterday (not in Klaviyo)",
    },
    ecomL7: {
      ...plan.overview.ecomL7,
      value: "—",
      priorDeltaPct: 0,
      yoyDeltaPct: 0,
      label: "Ecom · last 7 days (not in Klaviyo)",
    },
    attributedL30: metric(
      "Attributed revenue · last 30 days",
      l30.total,
      prior30.total,
    ),
    attributedYesterday: metric(
      "Attributed revenue · yesterday",
      yesterday.total,
      ydayWeekAgo.total,
    ),
    attributedL7: metric(
      "Attributed · last 7 days",
      l7.total,
      prior7.total,
    ),
    emailSharePct: emailShare,
    campaignSharePct: campaignShare,
  };

  const period = (
    window: string,
    attributed: number,
    prior: number,
  ): PeriodRow => ({
    window,
    ecom: "—",
    ecomPriorPct: 0,
    ecomYoyPct: 0,
    attributed: formatMoney(attributed),
    attrPriorPct: pctDelta(attributed, prior),
    attrYoyPct: 0,
  });

  const periods: PeriodRow[] = [
    period("Yesterday", yesterday.total, ydayWeekAgo.total),
    period("Last 7 days", l7.total, prior7.total),
    period("MTD", mtd.total, priorMtd.total),
    period("Last 30 days", l30.total, prior30.total),
  ];

  for (const window of ["QTD", "Last quarter", "YTD"]) {
    const existing = plan.periods.find((p) => p.window === window);
    periods.push(
      existing
        ? {
            ...existing,
            ecom: "—",
            ecomPriorPct: 0,
            ecomYoyPct: 0,
          }
        : {
            window,
            ecom: "—",
            ecomPriorPct: 0,
            ecomYoyPct: 0,
            attributed: "—",
            attrPriorPct: 0,
            attrYoyPct: 0,
          },
    );
  }

  const callout =
    `Live Klaviyo attributed revenue L30 is ${formatMoney(l30.total)} ` +
    `(${pctDelta(l30.total, prior30.total) >= 0 ? "+" : ""}${pctDelta(l30.total, prior30.total)}% vs prior 30d). ` +
    `Email/SMS mix ${emailShare}/${smsShare}; campaigns/flows ${campaignShare}/${flowShare}.`;

  return { overview, periods, callout };
}

/** Lightweight check used by UI/API before kicking off a long pull. */
export { aggregateStatistics };
