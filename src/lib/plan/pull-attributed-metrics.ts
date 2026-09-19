import {
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
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

function parseMoney(display: string | undefined): number | null {
  if (!display || display === "—") return null;
  const cleaned = display.replace(/[$,\s]/g, "").toUpperCase();
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([KM])?$/);
  if (!match) return null;
  let n = Number(match[1]);
  if (match[2] === "K") n *= 1_000;
  if (match[2] === "M") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

function conversionHintsFromPlan(plan: CustomerPlan): string[] {
  const placed: string[] = [];
  const other: string[] = [];
  for (const exp of plan.experiments) {
    for (const ref of exp.metricPull?.metrics ?? []) {
      if (!ref.metricId) continue;
      if (/placed order/i.test(ref.label ?? "")) placed.push(ref.metricId);
      else other.push(ref.metricId);
    }
  }
  return [...placed, ...other];
}

async function attributedFor(
  conversionMetricId: string,
  timeframe: { key: string } | { start: string; end: string },
) {
  const campaigns = await fetchCampaignValuesReport({
    conversionMetricId,
    timeframe,
    includeValueStats: true,
    requireValueStats: true,
  });
  const flows = await fetchFlowValuesReport({
    conversionMetricId,
    timeframe,
    includeValueStats: true,
    requireValueStats: true,
  });
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

/**
 * Second-pass pull: L30 attributed via campaign + flow values-reports.
 * Prior window is reconstructed from the last saved attributed card when
 * pulling prior would double the (slow) report budget.
 */
export async function pullAttributedMetrics(plan: CustomerPlan): Promise<{
  overview: CustomerPlan["overview"];
  periods: PeriodRow[];
  callout: string;
}> {
  const conversionMetricId = await findConversionMetricId(
    conversionHintsFromPlan(plan),
  );

  const l30 = await attributedFor(conversionMetricId, { key: "last_30_days" });

  const oldCurrent = parseMoney(plan.overview.attributedL30?.value);
  const oldDelta = plan.overview.attributedL30?.priorDeltaPct ?? 0;
  let prior30Total = 0;
  if (oldCurrent != null && oldCurrent > 0) {
    prior30Total =
      oldDelta <= -99.9 ? 0 : oldCurrent / (1 + oldDelta / 100);
  }

  // Empty attributed is almost never real for this account — fail the pass
  // instead of writing $0 over good figures.
  if (l30.total <= 0) {
    throw new Error(
      "Attributed L30 pull returned $0 (campaign/flow conversion_value missing). Not saving — retry after rate-limit wait.",
    );
  }

  const emailShare =
    l30.total > 0 ? Math.round((l30.email / l30.total) * 100) : 50;
  const campaignShare =
    l30.total > 0 ? Math.round((l30.campaign / l30.total) * 100) : 50;
  const smsShare = 100 - emailShare;
  const flowShare = 100 - campaignShare;

  const attributedL30 = metric(
    "Attributed revenue · last 30 days",
    l30.total,
    prior30Total,
  );

  const overview: CustomerPlan["overview"] = {
    ...plan.overview,
    attributedL30,
    emailSharePct: emailShare,
    campaignSharePct: campaignShare,
  };

  const periods = plan.periods.map((row) => {
    if (row.window !== "Last 30 days") return row;
    return {
      ...row,
      attributed: formatMoney(l30.total),
      attrPriorPct: pctDelta(l30.total, prior30Total),
    };
  });

  const ecomL30 = plan.overview.ecomL30?.value ?? "—";
  const ecomDelta = plan.overview.ecomL30?.priorDeltaPct ?? 0;
  const callout =
    `Live Klaviyo ecom (Placed Order) L30 is ${ecomL30} ` +
    `(${ecomDelta >= 0 ? "+" : ""}${ecomDelta}% vs prior 30d); ` +
    `attributed ${formatMoney(l30.total)} ` +
    `(${pctDelta(l30.total, prior30Total) >= 0 ? "+" : ""}${pctDelta(l30.total, prior30Total)}%). ` +
    `Email/SMS mix ${emailShare}/${smsShare}; campaigns/flows ${campaignShare}/${flowShare}.`;

  return { overview, periods, callout };
}
