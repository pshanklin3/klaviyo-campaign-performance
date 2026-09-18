"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { CampaignReport } from "@/lib/klaviyo/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  Mail,
  MessageSquare,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useCallback, useState } from "react";

type SortKey =
  | "sentAt"
  | "recipients"
  | "openRate"
  | "clickRate"
  | "conversionValue";

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "sms") return <MessageSquare className="size-3.5" />;
  if (channel === "push-notification")
    return <Smartphone className="size-3.5" />;
  return <Mail className="size-3.5" />;
}

function MetricTile({
  label,
  value,
  hint,
  delay,
}: {
  label: string;
  value: string;
  hint?: string;
  delay: number;
}) {
  return (
    <div
      className="metric-tile rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/80 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight text-[color:var(--ink)] tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function CampaignDashboard({
  initialReport,
}: {
  initialReport: CampaignReport;
}) {
  const [report, setReport] = useState<CampaignReport>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("conversionValue");
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/campaigns", { cache: "no-store" });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load campaign report");
        }
        const data = (await response.json()) as CampaignReport;
        setReport(data);
        setLastRefreshedAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...report.campaigns].sort((a, b) => {
    if (sortKey === "sentAt") {
      return (
        (b.sentAt ? Date.parse(b.sentAt) : 0) -
        (a.sentAt ? Date.parse(a.sentAt) : 0)
      );
    }
    return (b[sortKey] as number) - (a[sortKey] as number);
  });

  const best =
    report.campaigns.length > 0
      ? [...report.campaigns].sort(
          (a, b) => b.conversionValue - a.conversionValue,
        )[0]
      : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="reveal flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)]/70 px-3 py-1 text-xs font-medium text-[color:var(--ink-soft)] backdrop-blur">
            <span className="size-1.5 rounded-full bg-[color:var(--accent-strong)]" />
            Klaviyo · last 30 days
          </div>
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Campaign performance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)] sm:text-base">
              Opens, clicks, conversions, and revenue across sent campaigns in
              the last 30 days ({report.timeframe.start} →{" "}
              {report.timeframe.end}).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] text-[color:var(--ink-soft)]"
          >
            {report.source === "live" ? "Live Klaviyo data" : "Sample data"}
          </Badge>
          {lastRefreshedAt ? (
            <span className="text-xs text-[color:var(--ink-muted)]">
              Updated{" "}
              {lastRefreshedAt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="rounded-full border-[color:var(--panel-border)] bg-[color:var(--panel)]"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      {report.message ? (
        <div className="reveal rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          {report.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Campaigns"
              value={formatNumber(report.summary.campaignCount)}
              hint={report.accountName ?? "All sent campaigns"}
              delay={40}
            />
            <MetricTile
              label="Recipients"
              value={formatNumber(report.summary.recipients)}
              hint={`${formatNumber(report.summary.delivered)} delivered`}
              delay={90}
            />
            <MetricTile
              label="Open rate"
              value={formatPercent(report.summary.openRate)}
              hint={`${formatNumber(report.summary.opensUnique)} unique opens`}
              delay={140}
            />
            <MetricTile
              label="Revenue"
              value={formatCurrency(report.summary.conversionValue)}
              hint={`${formatCurrency(report.summary.revenuePerRecipient)} / recipient`}
              delay={190}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="reveal border-[color:var(--panel-border)] bg-[color:var(--panel)]/85 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-xl">
                  Channel mix
                </CardTitle>
                <CardDescription>
                  Delivery volume and click rate by channel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["email", "sms", "push-notification"] as const).map(
                  (channel) => {
                    const rows = report.campaigns.filter(
                      (c) => c.channel === channel,
                    );
                    if (rows.length === 0) return null;
                    const recipients = rows.reduce(
                      (sum, row) => sum + row.recipients,
                      0,
                    );
                    const clicks = rows.reduce(
                      (sum, row) => sum + row.clicksUnique,
                      0,
                    );
                    const delivered = rows.reduce(
                      (sum, row) => sum + row.delivered,
                      0,
                    );
                    const share =
                      report.summary.recipients > 0
                        ? recipients / report.summary.recipients
                        : 0;
                    return (
                      <div key={channel} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2 font-medium capitalize text-[color:var(--ink)]">
                            <ChannelIcon channel={channel} />
                            {channel === "push-notification"
                              ? "Push"
                              : channel}
                          </div>
                          <div className="text-[color:var(--ink-soft)] tabular-nums">
                            {formatNumber(recipients)} ·{" "}
                            {formatPercent(delivered > 0 ? clicks / delivered : 0)}{" "}
                            CTR
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--track)]">
                          <div
                            className="channel-bar h-full rounded-full bg-[color:var(--accent-strong)]"
                            style={{ width: `${Math.max(share * 100, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </CardContent>
            </Card>

            <Card className="reveal border-[color:var(--panel-border)] bg-[color:var(--panel)]/85 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-xl">
                  Top earner
                </CardTitle>
                <CardDescription>
                  Highest conversion value in the window
                </CardDescription>
              </CardHeader>
              <CardContent>
                {best ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-heading text-lg font-semibold text-[color:var(--ink)]">
                        {best.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                        Sent {formatDate(best.sentAt)} · {best.channel}
                      </p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[color:var(--ink-muted)]">Revenue</p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatCurrency(best.conversionValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[color:var(--ink-muted)]">
                          Open rate
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 font-semibold tabular-nums">
                          {formatPercent(best.openRate)}
                          {best.openRate >= report.summary.openRate ? (
                            <ArrowUpRight className="size-3.5 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="size-3.5 text-rose-600" />
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[color:var(--ink-muted)]">
                          Click rate
                        </p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatPercent(best.clickRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[color:var(--ink-muted)]">
                          Conversions
                        </p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatNumber(best.conversions)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--ink-soft)]">
                    No campaigns in this window yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="reveal border-[color:var(--panel-border)] bg-[color:var(--panel)]/90 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur">
            <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="font-heading text-xl">
                  Campaigns
                </CardTitle>
                <CardDescription>
                  Sort by the metric that matters for your review
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["conversionValue", "Revenue"],
                    ["openRate", "Open rate"],
                    ["clickRate", "Click rate"],
                    ["recipients", "Recipients"],
                    ["sentAt", "Sent date"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={sortKey === key ? "default" : "outline"}
                    onClick={() => setSortKey(key)}
                    className="rounded-full"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent
              className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
            >
              {sorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color:var(--panel-border)] px-4 py-10 text-center text-sm text-[color:var(--ink-soft)]">
                  No campaign performance found for the last 30 days.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Campaign</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                      <TableHead className="text-right">Open rate</TableHead>
                      <TableHead className="text-right">Click rate</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div className="min-w-48">
                            <p className="font-medium text-[color:var(--ink)]">
                              {campaign.name}
                            </p>
                            <p className="text-xs text-[color:var(--ink-muted)]">
                              Sent {formatDate(campaign.sentAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="gap-1 rounded-full capitalize"
                          >
                            <ChannelIcon channel={campaign.channel} />
                            {campaign.channel === "push-notification"
                              ? "Push"
                              : campaign.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(campaign.recipients)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {campaign.channel === "sms"
                            ? "—"
                            : formatPercent(campaign.openRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(campaign.clickRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(campaign.conversions)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(campaign.conversionValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
    </div>
  );
}
