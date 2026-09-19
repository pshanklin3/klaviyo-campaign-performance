import {
  aggregateStatistics,
  fetchCampaignValuesReport,
  fetchFlowValuesReport,
  findConversionMetricId,
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

/** Parse display values like "2.28%" or "$33.63" back to numbers for delta. */
function parseDisplayStat(display: string | undefined): number | null {
  if (!display || display === "—") return null;
  const cleaned = display.replace(/[$,\s]/g, "").trim();
  if (cleaned.endsWith("%")) {
    const n = Number(cleaned.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inferPreset(experiment: Experiment): string {
  const pull = ensureExperimentMetricPull(experiment).metricPull;
  if (pull.preset !== "custom") return pull.preset;
  const label = pull.goalMetricLabel.toLowerCase();
  if (
    label.includes("revenue /") ||
    label.includes("rev /") ||
    label.includes("per recipient")
  ) {
    return "revenue_per_recipient";
  }
  if (label.includes("attributed") || label.includes("revenue")) {
    return "attributed_revenue";
  }
  if (label.includes("open")) return "open_rate";
  if (label.includes("unsub")) return "unsubscribe_rate";
  if (label.includes("click")) return "click_rate";
  return "click_rate";
}

export type ExperimentPullPhase = "benchmark" | "current";

/**
 * Pull one window per call — Klaviyo values-reports are ~2/min, so benchmark
 * and current must be separate HTTP passes with a client wait between them.
 */
export async function pullExperimentMetrics(
  experiment: Experiment,
  phase: ExperimentPullPhase = "current",
): Promise<PullExperimentResult> {
  try {
    await findConversionMetricId();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Klaviyo not connected — use Connect Klaviyo (OAuth).",
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
    const preset = inferPreset(normalized);

    if (phase === "benchmark") {
      const benchmarkStats = await statsForWindow(
        normalized,
        bounds.benchmarkStart,
        bounds.benchmarkEnd,
        conversionMetricId,
      );
      const bench = formatStat(preset, benchmarkStats);
      const currentNumeric = parseDisplayStat(normalized.currentValue);
      const matchNote = (
        benchmarkStats as ReportStatistics & { _matchNote?: string }
      )._matchNote;

      return {
        ok: true,
        values: {
          metricLabel: pull.goalMetricLabel || normalized.metricLabel,
          benchmarkValue: bench.display,
          benchmarkNote: windows.benchmark,
          currentValue: normalized.currentValue,
          currentNote: normalized.currentNote,
          deltaPct: Number(deltaPct(bench.numeric, currentNumeric).toFixed(1)),
          lastPulledAt: new Date().toISOString(),
        },
        detail: matchNote
          ? `Benchmark via Reporting API (${pull.scope}); ${matchNote}`
          : `Benchmark via Reporting API (${pull.scope})`,
      };
    }

    const currentStats = await statsForWindow(
      normalized,
      bounds.currentStart,
      bounds.currentEnd,
      conversionMetricId,
    );
    const curr = formatStat(preset, currentStats);
    const benchNumeric = parseDisplayStat(normalized.benchmarkValue);
    const matchNote = (
      currentStats as ReportStatistics & { _matchNote?: string }
    )._matchNote;

    return {
      ok: true,
      values: {
        metricLabel: pull.goalMetricLabel || normalized.metricLabel,
        benchmarkValue: normalized.benchmarkValue,
        benchmarkNote: normalized.benchmarkNote,
        currentValue: curr.display,
        currentNote: windows.current,
        deltaPct: Number(deltaPct(benchNumeric, curr.numeric).toFixed(1)),
        lastPulledAt: new Date().toISOString(),
      },
      detail: matchNote
        ? `Current via Reporting API (${pull.scope}); ${matchNote}`
        : `Current via Reporting API (${pull.scope})`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Pull failed",
    };
  }
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
  const needsValueStats = /revenue|value|attributed|conversion_value|aov/i.test(
    `${pull.preset} ${pull.goalMetricLabel}`,
  );

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
      includeValueStats: needsValueStats,
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
    // Campaign IDs are long (e.g. 01M0…); short ids like Hf9L38 are metric ids — ignore.
    const rawIds = objectId
      ? objectId.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const ids = rawIds.filter(
      (id) => id.length >= 10 || /^01[A-Z0-9]/i.test(id),
    );
    const smsOnly =
      /sms/i.test(pull.objectLabel ?? "") ||
      /sms/i.test(experiment.name) ||
      experiment.itemType === "SMS";

    // Prefer channel filter only — contains-any with many IDs often returns empty.
    // Match campaign IDs client-side after the report returns.
    const filter = smsOnly ? 'equals(send_channel,"sms")' : undefined;
    const rows = await fetchCampaignValuesReport({
      conversionMetricId,
      timeframe,
      filters: filter,
      includeValueStats: needsValueStats,
    });

    let matched = rows;
    let matchNote = "";
    if (ids.length) {
      const idSet = new Set(ids);
      const byId = rows.filter((r) => idSet.has(r.groupings.campaign_id));
      if (byId.length > 0) {
        matched = byId;
        matchNote = `${byId.length}/${ids.length} campaign ids matched`;
      } else if (smsOnly && rows.length > 0) {
        // Cohort ids may be stale — fall back to all SMS in the window
        matched = rows.filter((r) => r.groupings.send_channel === "sms");
        matchNote = `campaign ids not in window; used ${matched.length} SMS campaign row(s)`;
      } else {
        matched = [];
      }
    } else if (smsOnly) {
      matched = rows.filter((r) => r.groupings.send_channel === "sms");
    }

    if (matched.length === 0) {
      throw new Error(
        ids.length
          ? `No campaign report rows for ${ids.slice(0, 3).join(", ")}${ids.length > 3 ? "…" : ""} in this window (${rows.length} total rows returned)`
          : smsOnly
            ? "No SMS campaign rows in this window"
            : "No matching campaign — set Klaviyo object ID (campaign id)",
      );
    }

    const stats = aggregateStatistics(matched.map((r) => r.statistics));
    if (matchNote) {
      (stats as ReportStatistics & { _matchNote?: string })._matchNote =
        matchNote;
    }
    return stats;
  }

  // Account / custom / aggregate
  const rows = await fetchCampaignValuesReport({
    conversionMetricId,
    timeframe,
    includeValueStats: needsValueStats,
  });
  if (rows.length === 0) {
    throw new Error("No campaign aggregate rows for this window");
  }
  return aggregateStatistics(rows.map((r) => r.statistics));
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

    // One window at a time — callers that need both should wait between phases
    const bench = await pullExperimentMetrics(normalized, "benchmark");
    if (!bench.ok) {
      next.push(normalized);
      results.push({
        id: normalized.id,
        name: normalized.name,
        ok: false,
        detail: bench.error,
      });
      continue;
    }
    const afterBench = { ...normalized, ...bench.values };
    const curr = await pullExperimentMetrics(afterBench, "current");
    if (!curr.ok) {
      next.push(afterBench);
      results.push({
        id: normalized.id,
        name: normalized.name,
        ok: false,
        detail: curr.error,
      });
      continue;
    }

    next.push({
      ...afterBench,
      ...curr.values,
    });
    results.push({
      id: normalized.id,
      name: normalized.name,
      ok: true,
      detail: curr.detail ?? "Updated",
    });
  }

  return { experiments: next, results };
}
