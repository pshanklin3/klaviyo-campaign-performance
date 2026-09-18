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
import type { CustomerPlan, OverviewMetric } from "@/lib/plan/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Tab = "performance" | "success";

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 tabular-nums ${
        positive ? "text-emerald-700" : "text-rose-700"
      }`}
    >
      <Icon className="size-3.5" />
      {positive ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

function MetricCard({ metric }: { metric: OverviewMetric }) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
        {metric.label}
      </p>
      <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
        {metric.value}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <span>
          vs prior <Delta value={metric.priorDeltaPct} suffix="%" />
        </span>
        <span>
          YoY <Delta value={metric.yoyDeltaPct} suffix="%" />
        </span>
      </div>
    </div>
  );
}

function ShareBar({
  leftLabel,
  rightLabel,
  leftPct,
}: {
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-[color:var(--ink-soft)]">
        <span>
          {leftLabel} {leftPct}%
        </span>
        <span>
          {rightLabel} {100 - leftPct}%
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[color:var(--track)]">
        <div
          className="bg-[color:var(--accent-strong)]"
          style={{ width: `${leftPct}%` }}
        />
        <div className="bg-[#1f6f8b]" style={{ width: `${100 - leftPct}%` }} />
      </div>
    </div>
  );
}

function formatSyncedAt(value: string) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function CustomerAccountView({
  plan,
  showAdminLink = false,
}: {
  plan: CustomerPlan;
  showAdminLink?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("performance");
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const { overview } = plan;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              Customer-facing
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Synced {formatSyncedAt(plan.syncedAt)}
            </Badge>
            {showAdminLink ? (
              <Link
                href={`/admin/${plan.customerId}`}
                className="text-xs font-medium text-[color:var(--accent-strong)] underline-offset-4 hover:underline"
              >
                CSM admin →
              </Link>
            ) : null}
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
            {plan.displayName}
          </h1>
          <p className="max-w-2xl text-sm text-[color:var(--ink-soft)]">
            Account health + success plan. Overview features the most actionable
            pulse; full period matrix stays one click away.
          </p>
        </div>
        <div className="flex rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          <Button
            type="button"
            size="sm"
            variant={tab === "performance" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setTab("performance")}
          >
            Performance
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "success" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setTab("success")}
          >
            Success plan
          </Button>
        </div>
      </header>

      {tab === "performance" ? (
        <div className="space-y-6">
          <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-xl">
                Account Overview
              </CardTitle>
              <CardDescription>
                Ecom + attributed revenue — featured windows only
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard metric={overview.ecomL30} />
                <MetricCard metric={overview.ecomYesterday} />
                <MetricCard metric={overview.attributedL30} />
                <MetricCard metric={overview.attributedYesterday} />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Near-term · last 7 days
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        Ecom
                      </p>
                      <p className="font-heading text-2xl font-semibold tabular-nums">
                        {overview.ecomL7.value}
                      </p>
                      <div className="mt-1 text-sm">
                        <Delta value={overview.ecomL7.priorDeltaPct} suffix="%" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        Attributed
                      </p>
                      <p className="font-heading text-2xl font-semibold tabular-nums">
                        {overview.attributedL7.value}
                      </p>
                      <div className="mt-1 text-sm">
                        <Delta
                          value={overview.attributedL7.priorDeltaPct}
                          suffix="%"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Action callout
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]">
                    {plan.callout || "No callout yet."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Channel mix · L30 attributed revenue
                  </p>
                  <ShareBar
                    leftLabel="Email"
                    rightLabel="SMS"
                    leftPct={overview.emailSharePct}
                  />
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Engine mix · L30 attributed revenue
                  </p>
                  <ShareBar
                    leftLabel="Campaigns"
                    rightLabel="Flows"
                    leftPct={overview.campaignSharePct}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--ink-muted)]">
                  Full matrix: Yesterday → YTD with prior + YoY for ecom and
                  attributed.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setShowAllPeriods((v) => !v)}
                >
                  {showAllPeriods ? "Hide all periods" : "All periods"}
                </Button>
              </div>

              {showAllPeriods ? (
                <div className="overflow-x-auto rounded-xl border border-[color:var(--panel-border)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Window</TableHead>
                        <TableHead className="text-right">Ecom</TableHead>
                        <TableHead className="text-right">Ecom prior</TableHead>
                        <TableHead className="text-right">Ecom YoY</TableHead>
                        <TableHead className="text-right">Attributed</TableHead>
                        <TableHead className="text-right">Attr prior</TableHead>
                        <TableHead className="text-right">Attr YoY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.periods.map((row) => (
                        <TableRow key={row.window}>
                          <TableCell>{row.window}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.ecom}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.ecomPriorPct === 0 ? (
                              "—"
                            ) : (
                              <Delta value={row.ecomPriorPct} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Delta value={row.ecomYoyPct} suffix="%" />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.attributed}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.attrPriorPct === 0 ? (
                              "—"
                            ) : (
                              <Delta value={row.attrPriorPct} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Delta value={row.attrYoyPct} suffix="%" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                In motion · performance experiments
              </CardTitle>
              <CardDescription>
                Active work — benchmark before the change vs current since
                go-live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.experiments.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-soft)]">
                  No experiments yet. Add them in CSM admin.
                </p>
              ) : (
                plan.experiments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            {item.itemType}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            Since {item.changedOn}
                          </Badge>
                        </div>
                        <a
                          href={item.klaviyoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-heading text-lg font-semibold text-[color:var(--ink)] underline-offset-4 hover:underline"
                        >
                          {item.name}
                          <ExternalLink className="size-3.5" />
                        </a>
                        <p className="text-sm text-[color:var(--ink-soft)]">
                          <span className="font-medium text-[color:var(--ink)]">
                            Goal:
                          </span>{" "}
                          {item.goal}
                        </p>
                        <p className="text-sm text-[color:var(--ink-soft)]">
                          <span className="font-medium text-[color:var(--ink)]">
                            Implemented:
                          </span>{" "}
                          {item.implemented}
                        </p>
                      </div>
                      <div className="grid min-w-[220px] grid-cols-2 gap-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/80 p-3">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                            Benchmark
                          </p>
                          <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                            {item.benchmarkValue}
                          </p>
                          <p className="text-xs text-[color:var(--ink-muted)]">
                            {item.metricLabel} · {item.benchmarkNote}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                            Current
                          </p>
                          <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                            {item.currentValue}
                          </p>
                          <p className="text-xs text-[color:var(--ink-muted)]">
                            {item.currentNote}
                          </p>
                          <div className="mt-1 text-sm">
                            <Delta value={item.deltaPct} suffix="%" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Continue / investigate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {plan.continueItems.map((text) => (
                  <div
                    key={text}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-emerald-950">Continue</p>
                    <p className="mt-1 text-emerald-900/90">{text}</p>
                  </div>
                ))}
                {plan.investigateItems.map((text) => (
                  <div
                    key={text}
                    className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-amber-950">Investigate</p>
                    <p className="mt-1 text-amber-900/90">{text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Module preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {plan.modules.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="rounded-full"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Goals & progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.goals.map((g) => (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {g.statement}
                      </p>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        {g.detail}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-[color:var(--ink-soft)]">
                      {g.progressPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--track)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--accent-strong)]"
                      style={{ width: `${g.progressPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Action plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {plan.tasks.map((t) => {
                  const Icon =
                    t.status === "Done"
                      ? CheckCircle2
                      : t.status === "Blocked"
                        ? CircleDashed
                        : Clock3;
                  return (
                    <div
                      key={t.id}
                      className="flex items-start gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                    >
                      <Icon className="mt-0.5 size-4 text-[color:var(--ink-muted)]" />
                      <div>
                        <p className="font-medium text-[color:var(--ink)]">
                          {t.title}
                        </p>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {t.owner} · {t.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Latest meeting
                </CardTitle>
                <CardDescription>
                  {plan.meeting
                    ? `${plan.meeting.date} · ${plan.meeting.title}`
                    : "No meeting logged"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[color:var(--ink-soft)]">
                {plan.meeting ? (
                  <>
                    <p>{plan.meeting.summary}</p>
                    <Separator />
                    <p className="font-medium text-[color:var(--ink)]">
                      Next steps
                    </p>
                    <ul className="list-disc space-y-1 pl-4">
                      {plan.meeting.nextSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Add a meeting note in CSM admin.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Product requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {plan.productRequests.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    <span>{item.name}</span>
                    <Badge variant="secondary" className="rounded-full">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Zendesk in progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {plan.tickets.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    <span>{item.title}</span>
                    <span className="text-xs text-[color:var(--ink-muted)]">
                      {item.meta}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
