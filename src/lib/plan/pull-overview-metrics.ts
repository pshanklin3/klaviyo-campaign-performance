import {
  aggregateStatistics,
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
  hasKlaviyoApiKey,
  queryMetricSumValue,
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

function rangeSum(
  metricId: string,
  start: Date,
  endExclusive: Date,
): Promise<number> {
  return queryMetricSumValue({
    metricId,
    startIso: `${isoDay(start)}T00:00:00`,
    endIsoExclusive: `${isoDay(endExclusive)}T00:00:00`,
  });
}

/** Pull Account Overview: total Placed Order (ecom) + attributed campaign/flow. */
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
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const yday = new Date(today);
  yday.setUTCDate(yday.getUTCDate() - 1);
  const ydayEnd = today;
  const ydayWeekAgo = new Date(yday);
  ydayWeekAgo.setUTCDate(ydayWeekAgo.getUTCDate() - 7);
  const ydayWeekAgoEnd = new Date(ydayWeekAgo);
  ydayWeekAgoEnd.setUTCDate(ydayWeekAgoEnd.getUTCDate() + 1);

  const l7Start = new Date(today);
  l7Start.setUTCDate(l7Start.getUTCDate() - 7);
  const priorL7End = l7Start;
  const priorL7Start = new Date(priorL7End);
  priorL7Start.setUTCDate(priorL7Start.getUTCDate() - 7);

  const l30Start = new Date(today);
  l30Start.setUTCDate(l30Start.getUTCDate() - 30);
  const priorL30End = l30Start;
  const priorL30Start = new Date(priorL30End);
  priorL30Start.setUTCDate(priorL30Start.getUTCDate() - 30);

  const mtdStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const priorMtdEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );
  const priorMtdStart = new Date(
    Date.UTC(priorMtdEnd.getUTCFullYear(), priorMtdEnd.getUTCMonth(), 1),
  );
  const dayOfMonth = now.getUTCDate();
  const priorMtdSameDayEnd = new Date(
    Date.UTC(
      priorMtdStart.getUTCFullYear(),
      priorMtdStart.getUTCMonth(),
      Math.min(dayOfMonth, priorMtdEnd.getUTCDate()) + 1,
    ),
  );

  const [
    l30,
    prior30,
    l7,
    prior7,
    yesterday,
    ydayWeekAgoAttr,
    mtd,
    priorMtd,
    ecomL30,
    ecomPrior30,
    ecomL7,
    ecomPrior7,
    ecomYday,
    ecomYdayPrior,
    ecomMtd,
    ecomPriorMtd,
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
      start: `${isoDay(ydayWeekAgo)}T00:00:00Z`,
      end: `${isoDay(ydayWeekAgoEnd)}T00:00:00Z`,
    }),
    attributedFor(conversionMetricId, { key: "this_month" }),
    attributedFor(conversionMetricId, {
      start: `${isoDay(priorMtdStart)}T00:00:00Z`,
      end: `${isoDay(priorMtdSameDayEnd)}T00:00:00Z`,
    }),
    rangeSum(conversionMetricId, l30Start, today),
    rangeSum(conversionMetricId, priorL30Start, priorL30End),
    rangeSum(conversionMetricId, l7Start, today),
    rangeSum(conversionMetricId, priorL7Start, priorL7End),
    rangeSum(conversionMetricId, yday, ydayEnd),
    rangeSum(conversionMetricId, ydayWeekAgo, ydayWeekAgoEnd),
    rangeSum(conversionMetricId, mtdStart, today),
    rangeSum(conversionMetricId, priorMtdStart, priorMtdSameDayEnd),
  ]);

  const emailShare =
    l30.total > 0 ? Math.round((l30.email / l30.total) * 100) : 50;
  const campaignShare =
    l30.total > 0 ? Math.round((l30.campaign / l30.total) * 100) : 50;
  const smsShare = 100 - emailShare;
  const flowShare = 100 - campaignShare;

  const overview: CustomerPlan["overview"] = {
    ecomL30: metric("Ecom revenue · last 30 days", ecomL30, ecomPrior30),
    ecomYesterday: metric("Ecom revenue · yesterday", ecomYday, ecomYdayPrior),
    ecomL7: metric("Ecom · last 7 days", ecomL7, ecomPrior7),
    attributedL30: metric(
      "Attributed revenue · last 30 days",
      l30.total,
      prior30.total,
    ),
    attributedYesterday: metric(
      "Attributed revenue · yesterday",
      yesterday.total,
      ydayWeekAgoAttr.total,
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
    ecom: number,
    ecomPrior: number,
    attributed: number,
    attrPrior: number,
  ): PeriodRow => ({
    window,
    ecom: formatMoney(ecom),
    ecomPriorPct: pctDelta(ecom, ecomPrior),
    ecomYoyPct: 0,
    attributed: formatMoney(attributed),
    attrPriorPct: pctDelta(attributed, attrPrior),
    attrYoyPct: 0,
  });

  const periods: PeriodRow[] = [
    period(
      "Yesterday",
      ecomYday,
      ecomYdayPrior,
      yesterday.total,
      ydayWeekAgoAttr.total,
    ),
    period("Last 7 days", ecomL7, ecomPrior7, l7.total, prior7.total),
    period("MTD", ecomMtd, ecomPriorMtd, mtd.total, priorMtd.total),
    period("Last 30 days", ecomL30, ecomPrior30, l30.total, prior30.total),
  ];

  for (const window of ["QTD", "Last quarter", "YTD"]) {
    const existing = plan.periods.find((p) => p.window === window);
    periods.push(
      existing ?? {
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
    `Live Klaviyo ecom (Placed Order) L30 is ${formatMoney(ecomL30)} ` +
    `(${pctDelta(ecomL30, ecomPrior30) >= 0 ? "+" : ""}${pctDelta(ecomL30, ecomPrior30)}% vs prior 30d); ` +
    `attributed ${formatMoney(l30.total)} ` +
    `(${pctDelta(l30.total, prior30.total) >= 0 ? "+" : ""}${pctDelta(l30.total, prior30.total)}%). ` +
    `Email/SMS mix ${emailShare}/${smsShare}; campaigns/flows ${campaignShare}/${flowShare}.`;

  return { overview, periods, callout };
}

export { aggregateStatistics };
