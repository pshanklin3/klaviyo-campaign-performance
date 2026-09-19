import {
  aggregateStatistics,
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
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

/** Campaign/flow reports are rate-limited (~1/s) — call them one at a time. */
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
  const campaigns = await fetchCampaignValuesReport({
    conversionMetricId,
    timeframe,
  });
  const flows = await fetchFlowValuesReport({ conversionMetricId, timeframe });
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

/**
 * Pull Account Overview.
 * Ecom (metric-aggregates) can cover all windows.
 * Attributed (campaign/flow reports) is tightly rate-limited — only refresh
 * L30 current + prior, and keep other attributed cells from the existing plan.
 */
export async function pullOverviewMetrics(plan: CustomerPlan): Promise<{
  overview: CustomerPlan["overview"];
  periods: PeriodRow[];
  callout: string;
}> {
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

  // Ecom aggregates — sequential via shared report queue in reporting.ts
  const ecomL30 = await rangeSum(conversionMetricId, l30Start, today);
  const ecomPrior30 = await rangeSum(
    conversionMetricId,
    priorL30Start,
    priorL30End,
  );
  const ecomL7 = await rangeSum(conversionMetricId, l7Start, today);
  const ecomPrior7 = await rangeSum(
    conversionMetricId,
    priorL7Start,
    priorL7End,
  );
  const ecomYday = await rangeSum(conversionMetricId, yday, ydayEnd);
  const ecomYdayPrior = await rangeSum(
    conversionMetricId,
    ydayWeekAgo,
    ydayWeekAgoEnd,
  );
  const ecomMtd = await rangeSum(conversionMetricId, mtdStart, today);
  const ecomPriorMtd = await rangeSum(
    conversionMetricId,
    priorMtdStart,
    priorMtdSameDayEnd,
  );

  // Attributed: only L30 (+ prior) to stay within reporting rate limits
  const l30 = await attributedFor(conversionMetricId, { key: "last_30_days" });
  const prior30 = await attributedFor(conversionMetricId, {
    start: `${isoDay(priorL30Start)}T00:00:00Z`,
    end: `${isoDay(priorL30End)}T00:00:00Z`,
  });

  const emailShare =
    l30.total > 0 ? Math.round((l30.email / l30.total) * 100) : 50;
  const campaignShare =
    l30.total > 0 ? Math.round((l30.campaign / l30.total) * 100) : 50;
  const smsShare = 100 - emailShare;
  const flowShare = 100 - campaignShare;

  // Keep shorter-window attributed cards from the previous plan when present
  const keepAttr = (
    key: keyof CustomerPlan["overview"],
    fallbackLabel: string,
  ): OverviewMetric => {
    const existing = plan.overview[key];
    if (
      existing &&
      typeof existing === "object" &&
      "value" in existing &&
      existing.value &&
      existing.value !== "—"
    ) {
      return existing;
    }
    return {
      label: fallbackLabel,
      value: "—",
      priorDeltaPct: 0,
      yoyDeltaPct: 0,
    };
  };

  const overview: CustomerPlan["overview"] = {
    ecomL30: metric("Ecom revenue · last 30 days", ecomL30, ecomPrior30),
    ecomYesterday: metric("Ecom revenue · yesterday", ecomYday, ecomYdayPrior),
    ecomL7: metric("Ecom · last 7 days", ecomL7, ecomPrior7),
    attributedL30: metric(
      "Attributed revenue · last 30 days",
      l30.total,
      prior30.total,
    ),
    attributedYesterday: keepAttr(
      "attributedYesterday",
      "Attributed revenue · yesterday",
    ),
    attributedL7: keepAttr("attributedL7", "Attributed · last 7 days"),
    emailSharePct: emailShare,
    campaignSharePct: campaignShare,
  };

  const period = (
    window: string,
    ecom: number,
    ecomPrior: number,
    attributed: string,
    attrPriorPct: number,
  ): PeriodRow => ({
    window,
    ecom: formatMoney(ecom),
    ecomPriorPct: pctDelta(ecom, ecomPrior),
    ecomYoyPct: 0,
    attributed,
    attrPriorPct,
    attrYoyPct: 0,
  });

  const priorPeriod = (window: string) =>
    plan.periods.find((p) => p.window === window);

  const periods: PeriodRow[] = [
    period(
      "Yesterday",
      ecomYday,
      ecomYdayPrior,
      priorPeriod("Yesterday")?.attributed ?? "—",
      priorPeriod("Yesterday")?.attrPriorPct ?? 0,
    ),
    period(
      "Last 7 days",
      ecomL7,
      ecomPrior7,
      priorPeriod("Last 7 days")?.attributed ?? "—",
      priorPeriod("Last 7 days")?.attrPriorPct ?? 0,
    ),
    period(
      "MTD",
      ecomMtd,
      ecomPriorMtd,
      priorPeriod("MTD")?.attributed ?? "—",
      priorPeriod("MTD")?.attrPriorPct ?? 0,
    ),
    period(
      "Last 30 days",
      ecomL30,
      ecomPrior30,
      formatMoney(l30.total),
      pctDelta(l30.total, prior30.total),
    ),
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
