import { AsyncLocalStorage } from "async_hooks";
import { formatISO, parseISO, subDays } from "date-fns";
import { getValidAccessToken } from "@/lib/klaviyo/oauth";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";

export type ReportStatistics = Record<string, number>;

export type FlowReportRow = {
  groupings: {
    flow_id: string;
    flow_message_id?: string;
    flow_message_name?: string;
    send_channel?: string;
  };
  statistics: ReportStatistics;
  flow_details?: { attributes?: { name?: string } };
};

export type CampaignReportRow = {
  groupings: {
    campaign_id: string;
    campaign_message_id?: string;
    send_channel?: string;
  };
  statistics: ReportStatistics;
};

type Timeframe =
  | { key: string }
  | { start: string; end: string };

export type KlaviyoAuth =
  | { type: "api_key"; key: string }
  | { type: "oauth"; accessToken: string };

const authStore = new AsyncLocalStorage<KlaviyoAuth>();

function getApiKey(): string | undefined {
  return (
    process.env.KLAVIYO_PRIVATE_API_KEY?.trim() ||
    process.env.KLAVIYO_API_KEY?.trim() ||
    undefined
  );
}

export function hasKlaviyoApiKey(): boolean {
  return Boolean(getApiKey());
}

/** True if we can call Klaviyo for this customer (OAuth or legacy API key). */
export async function hasKlaviyoConnection(
  customerId?: string,
): Promise<boolean> {
  if (hasKlaviyoApiKey()) return true;
  if (!customerId) return false;
  return Boolean(await getValidAccessToken(customerId));
}

export async function withKlaviyoAuth<T>(
  auth: KlaviyoAuth,
  fn: () => Promise<T>,
): Promise<T> {
  return authStore.run(auth, fn);
}

/** Resolve auth for a customer: prefer OAuth, fall back to env API key. */
export async function resolveKlaviyoAuth(
  customerId: string,
): Promise<KlaviyoAuth> {
  const accessToken = await getValidAccessToken(customerId);
  if (accessToken) return { type: "oauth", accessToken };
  const key = getApiKey();
  if (key) return { type: "api_key", key };
  throw new Error(
    "Klaviyo not connected. Click Connect Klaviyo (OAuth) on the account page.",
  );
}

function authHeaders(): Record<string, string> {
  const auth = authStore.getStore();
  if (auth?.type === "oauth") {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  if (auth?.type === "api_key") {
    return { Authorization: `Klaviyo-API-Key ${auth.key}` };
  }
  const key = getApiKey();
  if (key) return { Authorization: `Klaviyo-API-Key ${key}` };
  throw new Error("Missing Klaviyo auth");
}

/** Values-reports are ~1/s; metric-aggregates allow ~3/s with limited concurrency. */
let valuesReportQueue: Promise<unknown> = Promise.resolve();
let lastValuesReportAt = 0;
const VALUES_REPORT_GAP_MS = 1100;
const AGGREGATE_GAP_MS = 350;
const AGGREGATE_CONCURRENCY = 3;
let aggregateInFlight = 0;
const aggregateWaiters: Array<() => void> = [];
let lastAggregateAt = 0;

let cachedConversionMetricId: string | null = null;

export function clearConversionMetricCache() {
  cachedConversionMetricId = null;
}

function isValuesReportPath(path: string) {
  return path.includes("-values-reports") || path.includes("-series-reports");
}

function isAggregatePath(path: string) {
  return path.includes("metric-aggregates");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAggregateSlot() {
  if (aggregateInFlight < AGGREGATE_CONCURRENCY) {
    aggregateInFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    aggregateWaiters.push(() => {
      aggregateInFlight += 1;
      resolve();
    });
  });
}

function releaseAggregateSlot() {
  aggregateInFlight = Math.max(0, aggregateInFlight - 1);
  const next = aggregateWaiters.shift();
  if (next) next();
}

function parseExpectedAvailableMs(body: string, headerMs?: number): number | undefined {
  if (headerMs && headerMs > 0) return headerMs;
  const match = body.match(/Expected available in\s+(\d+)\s+seconds?/i);
  if (match) return Number(match[1]) * 1000;
  return undefined;
}

async function klaviyoFetchOnce<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string; retryAfterMs?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${KLAVIYO_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...authHeaders(),
        Accept: "application/json",
        "Content-Type": "application/json",
        revision: REVISION,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      const retryHeader = response.headers.get("Retry-After");
      const headerMs = retryHeader ? Number(retryHeader) * 1000 || undefined : undefined;
      const retryAfterMs = parseExpectedAvailableMs(body, headerMs);
      return { ok: false, status: response.status, body, retryAfterMs };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        body: `Klaviyo request timed out after 10s (${path})`,
      };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function klaviyoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const valuesReport = isValuesReportPath(path);
  const aggregate = isAggregatePath(path);

  const run = async (): Promise<T> => {
    if (valuesReport) {
      const wait = Math.max(0, VALUES_REPORT_GAP_MS - (Date.now() - lastValuesReportAt));
      if (wait > 0) await sleep(wait);
    } else if (aggregate) {
      await acquireAggregateSlot();
      try {
        const wait = Math.max(0, AGGREGATE_GAP_MS - (Date.now() - lastAggregateAt));
        if (wait > 0) await sleep(wait);
      } catch (error) {
        releaseAggregateSlot();
        throw error;
      }
    }

    try {
      // Do not sleep 40s+ inside the serverless function on 429 — surface to client.
      const result = await klaviyoFetchOnce<T>(path, init);
      if (valuesReport) lastValuesReportAt = Date.now();
      if (aggregate) lastAggregateAt = Date.now();
      if (result.ok) return result.data;

      if (result.status === 429) {
        const sec = result.retryAfterMs
          ? Math.ceil(result.retryAfterMs / 1000)
          : 45;
        throw new Error(
          `Klaviyo API 429: rate limited — wait ${sec}s then retry. ${result.body.slice(0, 200)}`,
        );
      }

      throw new Error(
        `Klaviyo API ${result.status}: ${result.body.slice(0, 400) || "request failed"}`,
      );
    } finally {
      if (aggregate) releaseAggregateSlot();
    }
  };

  if (!valuesReport && !aggregate) {
    return run();
  }

  if (valuesReport) {
    const next = valuesReportQueue.then(run, run);
    valuesReportQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  return run();
}

export async function findConversionMetricId(
  hintIds: string[] = [],
): Promise<string> {
  if (cachedConversionMetricId) return cachedConversionMetricId;

  const configured = process.env.KLAVIYO_CONVERSION_METRIC_ID?.trim();
  if (configured) {
    cachedConversionMetricId = configured;
    return configured;
  }

  // Plan already knows Placed Order id — skip the metrics list round-trip.
  if (hintIds[0]) {
    cachedConversionMetricId = hintIds[0];
    return hintIds[0];
  }

  const metrics = await klaviyoFetch<{
    data: { id: string; attributes: { name: string } }[];
  }>("/metrics/?fields[metric]=name");

  const preferred = ["Placed Order", "Ordered Product", "Checkout Started"];
  for (const name of preferred) {
    const match = metrics.data.find((m) => m.attributes.name === name);
    if (match) {
      cachedConversionMetricId = match.id;
      return match.id;
    }
  }

  if (metrics.data[0]) {
    cachedConversionMetricId = metrics.data[0].id;
    return metrics.data[0].id;
  }
  throw new Error("No conversion metrics found");
}

const RATE_STATS = [
  "click_rate",
  "open_rate",
  "conversion_rate",
  "unsubscribe_rate",
  "recipients",
  "delivered",
  "clicks_unique",
  "opens_unique",
  "conversions",
  "unsubscribes",
] as const;

const VALUE_STATS = [
  "conversion_value",
  "revenue_per_recipient",
  "average_order_value",
] as const;

export function toIsoDayStart(date: string): string {
  // date is YYYY-MM-DD
  return `${date}T00:00:00Z`;
}

export function toIsoDayEndExclusive(date: string): string {
  return `${date}T00:00:00Z`;
}

export function windowBounds(
  changedOn: string,
  benchmarkDays: number,
  now = new Date(),
): { benchmarkStart: string; benchmarkEnd: string; currentStart: string; currentEnd: string } {
  const change = parseISO(`${changedOn}T00:00:00Z`);
  const benchStart = subDays(change, benchmarkDays);
  return {
    benchmarkStart: formatISO(benchStart),
    benchmarkEnd: formatISO(change),
    currentStart: formatISO(change),
    currentEnd: formatISO(now),
  };
}

export async function fetchFlowValuesReport(options: {
  conversionMetricId: string;
  timeframe: Timeframe;
  filters?: string;
  /** Default true. Set false for rate-only pulls to avoid extra retries. */
  includeValueStats?: boolean;
}): Promise<FlowReportRow[]> {
  const includeValueStats = options.includeValueStats !== false;
  const attributes: {
    statistics: string[];
    timeframe: Timeframe;
    conversion_metric_id: string;
    filter?: string;
    value_statistics?: string[];
  } = {
    statistics: [...RATE_STATS],
    timeframe: options.timeframe,
    conversion_metric_id: options.conversionMetricId,
    ...(options.filters ? { filter: options.filters } : {}),
  };
  if (includeValueStats) {
    attributes.value_statistics = [...VALUE_STATS];
  }

  const payload = {
    data: {
      type: "flow-values-report",
      attributes,
    },
  };

  try {
    const report = await klaviyoFetch<{
      data: { attributes: { results: FlowReportRow[] } };
    }>("/flow-values-reports/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return report.data.attributes.results ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!includeValueStats || !message.toLowerCase().includes("value")) {
      throw error;
    }
    const report = await klaviyoFetch<{
      data: { attributes: { results: FlowReportRow[] } };
    }>("/flow-values-reports/", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "flow-values-report",
          attributes: {
            statistics: [...RATE_STATS],
            timeframe: options.timeframe,
            conversion_metric_id: options.conversionMetricId,
            ...(options.filters ? { filter: options.filters } : {}),
          },
        },
      }),
    });
    return report.data.attributes.results ?? [];
  }
}

export async function fetchCampaignValuesReport(options: {
  conversionMetricId: string;
  timeframe: Timeframe;
  filters?: string;
  includeValueStats?: boolean;
}): Promise<CampaignReportRow[]> {
  const includeValueStats = options.includeValueStats !== false;
  const baseAttributes = {
    statistics: [...RATE_STATS],
    timeframe: options.timeframe,
    conversion_metric_id: options.conversionMetricId,
    ...(options.filters ? { filter: options.filters } : {}),
  };

  try {
    const payload = {
      data: {
        type: "campaign-values-report",
        attributes: includeValueStats
          ? { ...baseAttributes, value_statistics: [...VALUE_STATS] }
          : baseAttributes,
      },
    };
    const report = await klaviyoFetch<{
      data: { attributes: { results: CampaignReportRow[] } };
    }>("/campaign-values-reports/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return report.data.attributes.results ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!includeValueStats || !message.toLowerCase().includes("value")) {
      throw error;
    }
    const report = await klaviyoFetch<{
      data: { attributes: { results: CampaignReportRow[] } };
    }>("/campaign-values-reports/", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "campaign-values-report",
          attributes: baseAttributes,
        },
      }),
    });
    return report.data.attributes.results ?? [];
  }
}

export function aggregateStatistics(rows: ReportStatistics[]): ReportStatistics {
  if (rows.length === 0) return {};
  if (rows.length === 1) return { ...rows[0] };

  const sumKeys = [
    "recipients",
    "delivered",
    "clicks_unique",
    "opens_unique",
    "conversions",
    "conversion_value",
    "unsubscribes",
    "clicks",
    "opens",
  ];
  const merged: ReportStatistics = {};
  for (const key of sumKeys) {
    merged[key] = rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  }
  const delivered = merged.delivered ?? 0;
  const recipients = merged.recipients ?? 0;
  const opens = merged.opens_unique ?? 0;
  const clicks = merged.clicks_unique ?? 0;
  const conversions = merged.conversions ?? 0;
  const conversionValue = merged.conversion_value ?? 0;
  merged.open_rate = delivered > 0 ? opens / delivered : 0;
  merged.click_rate = delivered > 0 ? clicks / delivered : 0;
  merged.conversion_rate = delivered > 0 ? conversions / delivered : 0;
  merged.unsubscribe_rate =
    delivered > 0 ? (merged.unsubscribes ?? 0) / delivered : 0;
  merged.revenue_per_recipient =
    recipients > 0 ? conversionValue / recipients : 0;
  return merged;
}

/**
 * Total metric value (e.g. all Placed Order revenue) by event time.
 * Use for store / ecom totals — not campaign/flow attributed revenue.
 */
export async function queryMetricSumValue(options: {
  metricId: string;
  startIso: string;
  endIsoExclusive: string;
  timezone?: string;
}): Promise<number> {
  const start = options.startIso.replace(/\.\d+Z$/, "").replace(/Z$/, "");
  const end = options.endIsoExclusive.replace(/\.\d+Z$/, "").replace(/Z$/, "");
  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: options.metricId,
        measurements: ["sum_value"],
        interval: "day",
        timezone: options.timezone ?? "UTC",
        filter: [
          `greater-or-equal(datetime,${start})`,
          `less-than(datetime,${end})`,
        ],
      },
    },
  };

  const report = await klaviyoFetch<{
    data: {
      attributes: {
        data: { measurements: { sum_value?: number[] } }[];
      };
    };
  }>("/metric-aggregates/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const series = report.data.attributes.data?.[0]?.measurements?.sum_value ?? [];
  return series.reduce((sum, n) => sum + (n ?? 0), 0);
}
