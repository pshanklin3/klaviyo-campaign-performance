import { formatISO, parseISO, subDays } from "date-fns";

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

async function klaviyoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Missing Klaviyo API key");

  const response = await fetch(`${KLAVIYO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      revision: REVISION,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Klaviyo API ${response.status}: ${body.slice(0, 400) || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
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
