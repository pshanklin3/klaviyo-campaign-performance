import {
  aggregateStatistics,
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
  hasKlaviyoApiKey,
  windowBounds,
  type ReportStatistics,
} from "@/lib/klaviyo/reporting";
import { describeMetricWindows, ensureExperimentMetricPull, presetMeta } from "@/lib/plan/experiment-metrics";
import type { Experiment } from "@/lib/plan/types";

export type ExperimentMetricValues = {
  metricLabel: string;
  benchmarkValue: string;
  benchmarkNote: string;
  currentValue: string;
  currentNote: string;
  deltaPct: number;
  lastPulledAt: string;
};

export type PullExperimentResult =
  | { ok: true; values: ExperimentMetricValues; detail?: string }
  | { ok: false; error: string };

function formatStat(
  preset: string,
  stats: ReportStatistics,
): { display: string; numeric: number | null } {
  const meta = presetMeta(preset);
  const format = meta?.format ?? "number";

  const keyForPreset: Record<string, string> = {
    click_rate: "click_rate",
    open_rate: "open_rate",
    placed_order_rate: "conversion_rate",
    attributed_revenue: "conversion_value",
    revenue_per_recipient: "revenue_per_recipient",
    recipients: "recipients",
    unsubscribe_rate: "unsubscribe_rate",
  };

  // Prefer preset mapping; fall back to first available rate-like key
  const key =
    keyForPreset[preset] ??
    (typeof stats.click_rate === "number"
      ? "click_rate"
      : typeof stats.revenue_per_recipient === "number"
        ? "revenue_per_recipient"
        : "recipients");

  const raw = stats[key];
  if (raw == null || Number.isNaN(raw)) {
    return { display: "—", numeric: null };
  }

  if (format === "percent" || key.endsWith("_rate")) {
    const pct = raw * 100;
    return { display: `${pct.toFixed(2)}%`, numeric: pct };
  }
  if (format === "currency" || key.includes("value") || key === "revenue_per_recipient") {
    return {
      display: `$${raw.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      numeric: raw,
    };
  }
  return {
    display: Math.round(raw).toLocaleString("en-US"),
    numeric: raw,
  };
}

function deltaPct(benchmark: number | null, current: number | null): number {
  if (benchmark == null || current == null) return 0;
  if (benchmark === 0) return current === 0 ? 0 : 100;
  return ((current - benchmark) / Math.abs(benchmark)) * 100;
}

async function statsForWindow(
  experiment: Experiment,
  startIso: string,
  endIso: string,
  conversionMetricId: string,
): Promise<ReportStatistics> {
  const pull = ensureExperimentMetricPull(experiment).metricPull;
  const timeframe = { start: startIso, end: endIso };
  const objectId = pull.objectId.trim();

  if (
    pull.scope === "flow_message" ||
    pull.scope === "flow" ||
    experiment.itemType === "Flow message"
  ) {
    const filter = objectId
      ? pull.scope === "flow"
        ? `equals(flow_id,"${objectId}")`
        : `equals(flow_message_id,"${objectId}")`
      : undefined;
    const rows = await fetchFlowValuesReport({
      conversionMetricId,
      timeframe,
      filters: filter,
    });

    let matched = rows;
    if (objectId) {
      matched =
        pull.scope === "flow"
          ? rows.filter((r) => r.groupings.flow_id === objectId)
          : rows.filter((r) => r.groupings.flow_message_id === objectId);
    } else if (pull.objectLabel || experiment.name) {
      const needle = (pull.objectLabel || experiment.name).toLowerCase();
      matched = rows.filter((r) => {
        const message = (r.groupings.flow_message_name ?? "").toLowerCase();
        const flow = (r.flow_details?.attributes?.name ?? "").toLowerCase();
        return message.includes(needle) || needle.includes(message) || flow.includes(needle);
      });
    }

    if (matched.length === 0) {
      throw new Error(
        objectId
          ? `No flow report rows for object ${objectId} in this window`
          : "No matching flow message — set Klaviyo object ID (flow message id)",
      );
    }

    return aggregateStatistics(matched.map((r) => r.statistics));
  }

  if (pull.scope === "campaign" || experiment.itemType === "Campaign") {
    const ids = objectId
      ? objectId.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const smsOnly =
      /sms/i.test(pull.objectLabel ?? "") ||
      /sms/i.test(experiment.name) ||
      experiment.itemType === "SMS";
    const idFilter =
      ids.length === 1
        ? `equals(campaign_id,"${ids[0]}")`
        : ids.length > 1
          ? `contains-any(campaign_id,[${ids.map((id) => `"${id}"`).join(",")}])`
          : undefined;
    const channelFilter = smsOnly ? 'equals(send_channel,"sms")' : undefined;
    const filter =
      idFilter && channelFilter
        ? `and(${idFilter},${channelFilter})`
        : idFilter ?? channelFilter;
    const rows = await fetchCampaignValuesReport({
      conversionMetricId,
      timeframe,
      filters: filter,
    });
    let matched = rows;
    if (ids.length) {
      const idSet = new Set(ids);
      matched = rows.filter((r) => idSet.has(r.groupings.campaign_id));
    } else if (smsOnly) {
      matched = rows.filter((r) => r.groupings.send_channel === "sms");
    }
    if (matched.length === 0) {
      throw new Error(
        ids.length
          ? `No campaign report rows for ${ids.join(", ")} in this window`
          : smsOnly
            ? "No SMS campaign rows — check send channel filter"
            : "No matching campaign — set Klaviyo object ID (campaign id)",
      );
    }
    return aggregateStatistics(matched.map((r) => r.statistics));
  }

  // Account / custom / aggregate: unfiltered campaign + flow blend is ambiguous;
  // use campaign report as a starting point when no object id.
  const rows = await fetchCampaignValuesReport({
    conversionMetricId,
    timeframe,
  });
  if (rows.length === 0) {
    throw new Error("No campaign aggregate rows for this window");
  }
  return aggregateStatistics(rows.map((r) => r.statistics));
}

export async function pullExperimentMetrics(
  experiment: Experiment,
): Promise<PullExperimentResult> {
  if (!hasKlaviyoApiKey()) {
    return {
      ok: false,
      error:
        "No KLAVIYO_PRIVATE_API_KEY on the server. Add it in Vercel env, or ask the Cursor agent (Klaviyo SSO) to refresh metrics.",
    };
  }

  const normalized = ensureExperimentMetricPull(experiment);
  const pull = normalized.metricPull;
  if (!pull.autoPull) {
    return { ok: false, error: "Auto-pull is off for this experiment" };
  }

  try {
    const conversionMetricId = await findConversionMetricId();
    const bounds = windowBounds(normalized.changedOn, pull.benchmarkDays);
    const windows = describeMetricWindows(normalized);

    const [benchmarkStats, currentStats] = await Promise.all([
      statsForWindow(
        normalized,
        bounds.benchmarkStart,
        bounds.benchmarkEnd,
        conversionMetricId,
      ),
      statsForWindow(
        normalized,
        bounds.currentStart,
        bounds.currentEnd,
        conversionMetricId,
      ),
    ]);

    const preset = pull.preset === "custom" ? "click_rate" : pull.preset;
    // For custom labels that look like revenue/click, infer from goal label
    const inferredPreset = (() => {
      if (pull.preset !== "custom") return pull.preset;
      const label = pull.goalMetricLabel.toLowerCase();
      if (label.includes("revenue /") || label.includes("rev /") || label.includes("per recipient")) {
        return "revenue_per_recipient";
      }
      if (label.includes("attributed") || label.includes("revenue")) {
        return "attributed_revenue";
      }
      if (label.includes("open")) return "open_rate";
      if (label.includes("unsub")) return "unsubscribe_rate";
      if (label.includes("click")) return "click_rate";
      return "click_rate";
    })();

    const bench = formatStat(inferredPreset || preset, benchmarkStats);
    const curr = formatStat(inferredPreset || preset, currentStats);

    return {
      ok: true,
      values: {
        metricLabel: pull.goalMetricLabel || normalized.metricLabel,
        benchmarkValue: bench.display,
        benchmarkNote: windows.benchmark,
        currentValue: curr.display,
        currentNote: windows.current,
        deltaPct: Number(deltaPct(bench.numeric, curr.numeric).toFixed(1)),
        lastPulledAt: new Date().toISOString(),
      },
      detail: `Pulled via Klaviyo Reporting API (${pull.scope})`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Pull failed",
    };
  }
}

export async function pullAllExperimentMetrics(
  experiments: Experiment[],
): Promise<{
  experiments: Experiment[];
  results: { id: string; name: string; ok: boolean; detail: string }[];
}> {
  const results: { id: string; name: string; ok: boolean; detail: string }[] =
    [];
  const next: Experiment[] = [];

  for (const experiment of experiments) {
    const normalized = ensureExperimentMetricPull(experiment);
    if (!normalized.metricPull.autoPull) {
      next.push(normalized);
      results.push({
        id: normalized.id,
        name: normalized.name,
        ok: true,
        detail: "Skipped (manual values)",
      });
      continue;
    }

    const pulled = await pullExperimentMetrics(normalized);
    if (!pulled.ok) {
      next.push(normalized);
      results.push({
        id: normalized.id,
        name: normalized.name,
        ok: false,
        detail: pulled.error,
      });
      continue;
    }

    next.push({
      ...normalized,
      ...pulled.values,
    });
    results.push({
      id: normalized.id,
      name: normalized.name,
      ok: true,
      detail: pulled.detail ?? "Updated",
    });
  }

  return { experiments: next, results };
}
