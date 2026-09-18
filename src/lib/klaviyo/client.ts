import { formatISO, subDays } from "date-fns";
import { readFile } from "fs/promises";
import path from "path";
import { getMockCampaignReport } from "./mock";
import type {
  CampaignPerformance,
  CampaignReport,
  CampaignSummary,
  SendChannel,
} from "./types";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";

type KlaviyoListResponse<T> = {
  data: T[];
  links?: { next?: string | null };
};

type CampaignResource = {
  id: string;
  attributes: {
    name: string;
    status: string;
    send_time?: string | null;
    scheduled_at?: string | null;
  };
};

type MetricResource = {
  id: string;
  attributes: { name: string };
};

type CampaignValuesResult = {
  groupings: {
    campaign_id: string;
    campaign_message_id?: string;
    send_channel?: string;
  };
  statistics: Record<string, number>;
};

function getApiKey(): string | undefined {
  return (
    process.env.KLAVIYO_PRIVATE_API_KEY?.trim() ||
    process.env.KLAVIYO_API_KEY?.trim() ||
    undefined
  );
}

async function klaviyoFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing Klaviyo API key");
  }

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

async function fetchAllCampaigns(): Promise<CampaignResource[]> {
  const campaigns: CampaignResource[] = [];
  const paths = [
    "/campaigns/?filter=equals(messages.channel,'email')&fields[campaign]=name,status,send_time,scheduled_at&page[size]=50",
    "/campaigns/?filter=equals(messages.channel,'sms')&fields[campaign]=name,status,send_time,scheduled_at&page[size]=50",
  ];

  for (const initialPath of paths) {
    let next: string | null = initialPath;
    while (next) {
      const requestPath = next.startsWith("http")
        ? next.replace(KLAVIYO_BASE, "")
        : next;
      const page: KlaviyoListResponse<CampaignResource> =
        await klaviyoFetch<KlaviyoListResponse<CampaignResource>>(requestPath);
      campaigns.push(...page.data);
      const nextLink = page.links?.next ?? null;
      next =
        nextLink?.startsWith("http")
          ? nextLink.replace(KLAVIYO_BASE, "")
          : nextLink;
    }
  }

  // Dedupe by id
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  return Array.from(byId.values());
}

async function findConversionMetricId(): Promise<string> {
  const configured = process.env.KLAVIYO_CONVERSION_METRIC_ID?.trim();
  if (configured) return configured;

  const metrics = await klaviyoFetch<KlaviyoListResponse<MetricResource>>(
    "/metrics/?fields[metric]=name&page[size]=100",
  );

  const preferred = ["Placed Order", "Ordered Product", "Checkout Started"];
  for (const name of preferred) {
    const match = metrics.data.find((m) => m.attributes.name === name);
    if (match) return match.id;
  }

  if (metrics.data[0]) return metrics.data[0].id;
  throw new Error("No conversion metrics found in Klaviyo account");
}

async function fetchCampaignValues(
  conversionMetricId: string,
): Promise<CampaignValuesResult[]> {
  const statistics = [
    "recipients",
    "delivered",
    "opens_unique",
    "open_rate",
    "clicks_unique",
    "click_rate",
    "click_to_open_rate",
    "conversions",
    "conversion_rate",
    "conversion_value",
    "revenue_per_recipient",
    "unsubscribes",
    "unsubscribe_rate",
  ];

  const payload = {
    data: {
      type: "campaign-values-report",
      attributes: {
        statistics,
        timeframe: { key: "last_30_days" },
        conversion_metric_id: conversionMetricId,
      },
    },
  };

  const report = await klaviyoFetch<{
    data: { attributes: { results: CampaignValuesResult[] } };
  }>("/campaign-values-reports/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return report.data.attributes.results ?? [];
}

function normalizeChannel(value?: string): SendChannel {
  if (value === "sms") return "sms";
  if (value === "push-notification") return "push-notification";
  return "email";
}

function normalizeStatus(
  status: string,
): CampaignPerformance["status"] {
  const value = status.toLowerCase();
  if (value.includes("sent") || value === "sent") return "sent";
  if (value.includes("schedul")) return "scheduled";
  if (value.includes("cancel")) return "cancelled";
  return "draft";
}

function summarize(campaigns: CampaignPerformance[]): CampaignSummary {
  const recipients = campaigns.reduce((sum, c) => sum + c.recipients, 0);
  const delivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
  const opensUnique = campaigns.reduce((sum, c) => sum + c.opensUnique, 0);
  const clicksUnique = campaigns.reduce((sum, c) => sum + c.clicksUnique, 0);
  const conversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const conversionValue = campaigns.reduce(
    (sum, c) => sum + c.conversionValue,
    0,
  );

  return {
    campaignCount: campaigns.length,
    recipients,
    delivered,
    opensUnique,
    openRate: delivered > 0 ? opensUnique / delivered : 0,
    clicksUnique,
    clickRate: delivered > 0 ? clicksUnique / delivered : 0,
    conversions,
    conversionValue,
    revenuePerRecipient: recipients > 0 ? conversionValue / recipients : 0,
  };
}

function mergeCampaignData(
  campaigns: CampaignResource[],
  results: CampaignValuesResult[],
): CampaignPerformance[] {
  const metaById = new Map(campaigns.map((c) => [c.id, c]));
  const statsById = new Map<string, CampaignValuesResult>();

  for (const result of results) {
    const id = result.groupings.campaign_id;
    const existing = statsById.get(id);
    if (!existing) {
      statsById.set(id, result);
      continue;
    }
    // Aggregate if multiple message rows exist for one campaign
    const mergedStats: Record<string, number> = { ...existing.statistics };
    for (const [key, value] of Object.entries(result.statistics)) {
      if (key.endsWith("_rate") || key === "revenue_per_recipient") {
        continue;
      }
      mergedStats[key] = (mergedStats[key] ?? 0) + (value ?? 0);
    }
    const delivered = mergedStats.delivered ?? 0;
    const opens = mergedStats.opens_unique ?? 0;
    const clicks = mergedStats.clicks_unique ?? 0;
    const recipients = mergedStats.recipients ?? 0;
    const conversions = mergedStats.conversions ?? 0;
    const conversionValue = mergedStats.conversion_value ?? 0;
    mergedStats.open_rate = delivered > 0 ? opens / delivered : 0;
    mergedStats.click_rate = delivered > 0 ? clicks / delivered : 0;
    mergedStats.click_to_open_rate = opens > 0 ? clicks / opens : 0;
    mergedStats.conversion_rate = delivered > 0 ? conversions / delivered : 0;
    mergedStats.revenue_per_recipient =
      recipients > 0 ? conversionValue / recipients : 0;
    mergedStats.unsubscribe_rate =
      delivered > 0
        ? (mergedStats.unsubscribes ?? 0) / delivered
        : 0;
    statsById.set(id, {
      ...existing,
      statistics: mergedStats,
    });
  }

  const rows: CampaignPerformance[] = [];

  for (const [id, result] of statsById) {
    const meta = metaById.get(id);
    const stats = result.statistics;
    rows.push({
      id,
      name: meta?.attributes.name ?? `Campaign ${id.slice(0, 8)}`,
      channel: normalizeChannel(result.groupings.send_channel),
      status: normalizeStatus(meta?.attributes.status ?? "sent"),
      sentAt:
        meta?.attributes.send_time ??
        meta?.attributes.scheduled_at ??
        null,
      recipients: stats.recipients ?? 0,
      delivered: stats.delivered ?? 0,
      opensUnique: stats.opens_unique ?? 0,
      openRate: stats.open_rate ?? 0,
      clicksUnique: stats.clicks_unique ?? 0,
      clickRate: stats.click_rate ?? 0,
      clickToOpenRate: stats.click_to_open_rate ?? 0,
      conversions: stats.conversions ?? 0,
      conversionRate: stats.conversion_rate ?? 0,
      conversionValue: stats.conversion_value ?? 0,
      revenuePerRecipient: stats.revenue_per_recipient ?? 0,
      unsubscribes: stats.unsubscribes ?? 0,
      unsubscribeRate: stats.unsubscribe_rate ?? 0,
    });
  }

  return rows.sort((a, b) => {
    const aTime = a.sentAt ? Date.parse(a.sentAt) : 0;
    const bTime = b.sentAt ? Date.parse(b.sentAt) : 0;
    return bTime - aTime;
  });
}

async function getLiveSnapshot(): Promise<CampaignReport | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "src/data/live-campaign-report.json",
    );
    const raw = await readFile(filePath, "utf8");
    const report = JSON.parse(raw) as CampaignReport;
    if (!report?.campaigns || !report?.summary) return null;
    return {
      ...report,
      source: "live",
      message: undefined,
    };
  } catch {
    return null;
  }
}

export async function getCampaignReport(): Promise<CampaignReport> {
  const end = new Date();
  const start = subDays(end, 29);
  const timeframe = {
    key: "last_30_days" as const,
    start: formatISO(start, { representation: "date" }),
    end: formatISO(end, { representation: "date" }),
  };

  if (!getApiKey()) {
    const snapshot = await getLiveSnapshot();
    if (snapshot) return snapshot;
    return getMockCampaignReport();
  }

  try {
    const [campaigns, conversionMetricId] = await Promise.all([
      fetchAllCampaigns(),
      findConversionMetricId(),
    ]);
    const results = await fetchCampaignValues(conversionMetricId);
    const rows = mergeCampaignData(campaigns, results);

    return {
      source: "live",
      timeframe,
      accountName: null,
      summary: summarize(rows),
      campaigns: rows,
      message:
        rows.length === 0
          ? "Connected to Klaviyo, but no campaign performance was returned for the last 30 days."
          : undefined,
    };
  } catch (error) {
    const snapshot = await getLiveSnapshot();
    if (snapshot) {
      const detail =
        error instanceof Error ? error.message : "Unknown Klaviyo error";
      return {
        ...snapshot,
        message: `Live API request failed (${detail}). Showing the latest synced Klaviyo snapshot.`,
      };
    }
    const mock = getMockCampaignReport();
    const detail =
      error instanceof Error ? error.message : "Unknown Klaviyo error";
    return {
      ...mock,
      message: `Live Klaviyo request failed (${detail}). Showing sample data instead.`,
    };
  }
}
