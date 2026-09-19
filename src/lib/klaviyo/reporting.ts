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

/** Reporting endpoints are ~1/s burst / ~2/m steady — serialize + retry 429s. */
let reportQueue: Promise<unknown> = Promise.resolve();
let lastReportAt = 0;
const REPORT_GAP_MS = 1100;

function isReportingPath(path: string) {
  return (
    path.includes("-values-reports") ||
    path.includes("-series-reports") ||
    path.includes("metric-aggregates")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function klaviyoFetchOnce<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string; retryAfterMs?: number }> {
  const response = await fetch(`${KLAVIYO_BASE}${path}`, {
    ...init,
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
    const retryAfterMs = retryHeader
      ? Number(retryHeader) * 1000 || 30_000
      : undefined;
    return { ok: false, status: response.status, body, retryAfterMs };
  }

  return { ok: true, data: (await response.json()) as T };
}

async function klaviyoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const run = async (): Promise<T> => {
    const reporting = isReportingPath(path);
    if (reporting) {
      const wait = Math.max(0, REPORT_GAP_MS - (Date.now() - lastReportAt));
      if (wait > 0) await sleep(wait);
    }

    let attempt = 0;
    while (attempt < 5) {
      attempt += 1;
      const result = await klaviyoFetchOnce<T>(path, init);
      if (reporting) lastReportAt = Date.now();
      if (result.ok) return result.data;

      if (result.status === 429 && attempt < 5) {
        await sleep(result.retryAfterMs ?? Math.min(60_000, 5_000 * attempt));
        continue;
      }

      throw new Error(
        `Klaviyo API ${result.status}: ${result.body.slice(0, 400) || "request failed"}`,
      );
    }

    throw new Error("Klaviyo API: exhausted retries");
  };

  if (!isReportingPath(path)) {
    return run();
  }

  const next = reportQueue.then(run, run);
  reportQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function findConversionMetricId(): Promise<string> {
  const configured = process.env.KLAVIYO_CONVERSION_METRIC_ID?.trim();
  if (configured) return configured;

  const metrics = await klaviyoFetch<{
    data: { id: string; attributes: { name: string } }[];
  }>("/metrics/?fields[metric]=name&page[size]=100");

  const preferred = ["Placed Order", "Ordered Product", "Checkout Started"];
  for (const name of preferred) {
    const match = metrics.data.find((m) => m.attributes.name === name);
    if (match) return match.id;
  }
  if (metrics.data[0]) return metrics.data[0].id;
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
}): Promise<FlowReportRow[]> {
  const payload = {
    data: {
      type: "flow-values-report",
      attributes: {
        statistics: [...RATE_STATS],
        timeframe: options.timeframe,
        conversion_metric_id: options.conversionMetricId,
        ...(options.filters ? { filter: options.filters } : {}),
      },
    },
  };

  // value stats in a second field when supported
  (
    payload.data.attributes as {
      statistics: string[];
      conversion_metric_id: string;
      timeframe: Timeframe;
      filter?: string;
      value_statistics?: string[];
    }
  ).value_statistics = [...VALUE_STATS];

  try {
    const report = await klaviyoFetch<{
      data: { attributes: { results: FlowReportRow[] } };
    }>("/flow-values-reports/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return report.data.attributes.results ?? [];
  } catch (error) {
    // Retry without value statistics if conversion metric doesn't support values
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("value")) throw error;
    const retryPayload = {
      data: {
        type: "flow-values-report",
        attributes: {
          statistics: [...RATE_STATS],
          timeframe: options.timeframe,
          conversion_metric_id: options.conversionMetricId,
          ...(options.filters ? { filter: options.filters } : {}),
        },
      },
    };
    const report = await klaviyoFetch<{
      data: { attributes: { results: FlowReportRow[] } };
    }>("/flow-values-reports/", {
      method: "POST",
      body: JSON.stringify(retryPayload),
    });
    return report.data.attributes.results ?? [];
  }
}

export async function fetchCampaignValuesReport(options: {
  conversionMetricId: string;
  timeframe: Timeframe;
  filters?: string;
}): Promise<CampaignReportRow[]> {
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
        attributes: {
          ...baseAttributes,
          value_statistics: [...VALUE_STATS],
        },
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
    if (!message.toLowerCase().includes("value")) throw error;
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
