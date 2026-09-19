import {
  findConversionMetricId,
  queryMetricSumValue,
} from "@/lib/klaviyo/reporting";
import type { CustomerPlan, OverviewMetric, PeriodRow } from "@/lib/plan/types";

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

/**
 * Fast overview refresh for Vercel time limits.
 * Pulls ecom (Placed Order) via metric-aggregates only.
 * Keeps attributed / mix cards from the last successful plan — campaign/flow
 * values-reports are too slow/rate-limited for a single serverless pass.
 */
export async function pullOverviewMetrics(plan: CustomerPlan): Promise<{
  overview: CustomerPlan["overview"];
  periods: PeriodRow[];
  callout: string;
}> {
  const conversionMetricId = await findConversionMetricId(
    conversionHintsFromPlan(plan),
  );
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

  // Ecom windows via metric-aggregates (cheap vs values-reports)
  const [
    ecomL30,
    ecomPrior30,
    ecomL7,
    ecomPrior7,
    ecomYday,
    ecomYdayPrior,
    ecomMtd,
    ecomPriorMtd,
  ] = await Promise.all([
    rangeSum(conversionMetricId, l30Start, today),
    rangeSum(conversionMetricId, priorL30Start, priorL30End),
    rangeSum(conversionMetricId, l7Start, today),
    rangeSum(conversionMetricId, priorL7Start, priorL7End),
    rangeSum(conversionMetricId, yday, ydayEnd),
    rangeSum(conversionMetricId, ydayWeekAgo, ydayWeekAgoEnd),
    rangeSum(conversionMetricId, mtdStart, today),
    rangeSum(conversionMetricId, priorMtdStart, priorMtdSameDayEnd),
  ]);

  const priorPeriod = (window: string) =>
    plan.periods.find((p) => p.window === window);

  const overview: CustomerPlan["overview"] = {
    ecomL30: metric("Ecom revenue · last 30 days", ecomL30, ecomPrior30),
    ecomYesterday: metric("Ecom revenue · yesterday", ecomYday, ecomYdayPrior),
    ecomL7: metric("Ecom · last 7 days", ecomL7, ecomPrior7),
    attributedL30: plan.overview.attributedL30,
    attributedYesterday: plan.overview.attributedYesterday,
    attributedL7: plan.overview.attributedL7,
    emailSharePct: plan.overview.emailSharePct,
    campaignSharePct: plan.overview.campaignSharePct,
  };

  const period = (
    window: string,
    ecom: number,
    ecomPrior: number,
  ): PeriodRow => {
    const prev = priorPeriod(window);
    return {
      window,
      ecom: formatMoney(ecom),
      ecomPriorPct: pctDelta(ecom, ecomPrior),
      ecomYoyPct: 0,
      attributed: prev?.attributed ?? "—",
      attrPriorPct: prev?.attrPriorPct ?? 0,
      attrYoyPct: 0,
    };
  };

  const periods: PeriodRow[] = [
    period("Yesterday", ecomYday, ecomYdayPrior),
    period("Last 7 days", ecomL7, ecomPrior7),
    period("MTD", ecomMtd, ecomPriorMtd),
    period("Last 30 days", ecomL30, ecomPrior30),
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
    `(${pctDelta(ecomL30, ecomPrior30) >= 0 ? "+" : ""}${pctDelta(ecomL30, ecomPrior30)}% vs prior 30d). ` +
    `Attributed figures from last attributed pass (campaign/flow reports).`;

  return { overview, periods, callout };
}
