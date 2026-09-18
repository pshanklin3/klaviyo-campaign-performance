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
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
} from "lucide-react";
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
        <div
          className="bg-[#1f6f8b]"
          style={{ width: `${100 - leftPct}%` }}
        />
      </div>
    </div>
  );
}

export function AccountMockup() {
  const [tab, setTab] = useState<Tab>("performance");
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Mockup only</strong> — static sample data for discussion. Not
        live Klaviyo / Zendesk. Path: <code>/mockup</code>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              Customer-facing
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Synced Sep 18, 2026 · 2:14 PM
            </Badge>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
            Hunter Trading Company
          </h1>
          <p className="max-w-2xl text-sm text-[color:var(--ink-soft)]">
            Account health + success plan. Executive strip features the most
            actionable pulse; full period matrix stays one click away.
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
                Featured pulse — ecom + attributed revenue, not every window at
                once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Ecom revenue · last 30 days
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
                    $1.24M
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span>
                      vs prior <Delta value={-4.2} suffix="%" />
                    </span>
                    <span>
                      YoY <Delta value={11.8} suffix="%" />
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Ecom revenue · yesterday
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
                    $38.2K
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span>
                      vs prior <Delta value={2.1} suffix="%" />
                    </span>
                    <span>
                      YoY <Delta value={-1.4} suffix="%" />
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Attributed revenue · last 30 days
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
                    $388K
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span>
                      vs prior <Delta value={6.3} suffix="%" />
                    </span>
                    <span>
                      YoY <Delta value={19.4} suffix="%" />
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Attributed revenue · yesterday
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
                    $14.6K
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span>
                      vs prior <Delta value={-3.8} suffix="%" />
                    </span>
                    <span>
                      YoY <Delta value={8.1} suffix="%" />
                    </span>
                  </div>
                </div>
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
                        $286K
                      </p>
                      <div className="mt-1 text-sm">
                        <Delta value={8.4} suffix="%" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        Attributed
                      </p>
                      <p className="font-heading text-2xl font-semibold tabular-nums">
                        $91K
                      </p>
                      <div className="mt-1 text-sm">
                        <Delta value={5.2} suffix="%" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Action callout
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]">
                    SMS flow attributed revenue is soft (−18% WoW) while email
                    campaigns are +12% YoY — review SMS cadence before Labor Day
                    follow-ups repeat.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Channel mix · L30 attributed revenue
                  </p>
                  <ShareBar leftLabel="Email" rightLabel="SMS" leftPct={65} />
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Engine mix · L30 attributed revenue
                  </p>
                  <ShareBar
                    leftLabel="Campaigns"
                    rightLabel="Flows"
                    leftPct={42}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--ink-muted)]">
                  Full matrix includes Yesterday, L7, MTD, L30, QTD, last
                  quarter, YTD — ecom + attributed, each with prior + YoY.
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
                      {[
                        ["Yesterday", "$38.2K", 2.1, -1.4, "$14.6K", -3.8, 8.1],
                        ["Last 7 days", "$286K", 8.4, 9.2, "$91K", 5.2, 14.0],
                        ["MTD", "$612K", -1.2, 14.0, "$201K", 2.4, 17.5],
                        ["Last 30 days", "$1.24M", -4.2, 11.8, "$388K", 6.3, 19.4],
                        ["QTD", "$2.91M", 3.5, 16.2, "$902K", 4.1, 18.0],
                        ["Last quarter", "$3.44M", -0.8, 8.9, "$1.05M", 1.2, 12.6],
                        ["YTD", "$9.12M", 0, 13.4, "$2.84M", 0, 15.8],
                      ].map(
                        ([label, ecom, ePrior, eYoy, attr, aPrior, aYoy]) => (
                          <TableRow key={String(label)}>
                            <TableCell>{label}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {ecom}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(ePrior) === 0 ? (
                                "—"
                              ) : (
                                <Delta value={Number(ePrior)} suffix="%" />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Delta value={Number(eYoy)} suffix="%" />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {attr}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(aPrior) === 0 ? (
                                "—"
                              ) : (
                                <Delta value={Number(aPrior)} suffix="%" />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Delta value={Number(aYoy)} suffix="%" />
                            </TableCell>
                          </TableRow>
                        ),
                      )}
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
                Active work on revenue or engagement — benchmark before the
                change vs current since go-live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  name: "Browse Abandon · Email 2",
                  href: "https://www.klaviyo.com/flow/example/browse-abandon",
                  type: "Flow message",
                  goal: "Increase click rate",
                  implemented: "Moved primary CTA above the fold",
                  changedOn: "Sep 8, 2026",
                  metric: "Click rate",
                  benchmark: "1.8%",
                  benchmarkNote: "L30 before change",
                  current: "2.4%",
                  currentNote: "Since Sep 8",
                  delta: 33.3,
                },
                {
                  name: "Welcome Series · SMS 1",
                  href: "https://www.klaviyo.com/flow/example/welcome-sms",
                  type: "Flow message",
                  goal: "Increase attributed revenue / recipient",
                  implemented: "Shortened copy + single offer link",
                  changedOn: "Sep 11, 2026",
                  metric: "Rev / recipient",
                  benchmark: "$0.41",
                  benchmarkNote: "L30 before change",
                  current: "$0.38",
                  currentNote: "Since Sep 11",
                  delta: -7.3,
                },
                {
                  name: "VIP early access · Fall drop",
                  href: "https://www.klaviyo.com/campaign/example/vip-fall",
                  type: "Campaign",
                  goal: "Hold open rate while lifting CTR",
                  implemented: "New hero + CTA label test",
                  changedOn: "Sep 15, 2026",
                  metric: "Click rate",
                  benchmark: "18.0%",
                  benchmarkNote: "Prior VIP sends L30",
                  current: "19.6%",
                  currentNote: "This send",
                  delta: 8.9,
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {item.type}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          Since {item.changedOn}
                        </Badge>
                      </div>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-heading text-lg font-semibold text-[color:var(--ink)] underline-offset-4 hover:underline"
                      >
                        {item.name}
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
                          {item.benchmark}
                        </p>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {item.metric} · {item.benchmarkNote}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                          Current
                        </p>
                        <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                          {item.current}
                        </p>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          {item.currentNote}
                        </p>
                        <div className="mt-1 text-sm">
                          <Delta value={item.delta} suffix="%" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Continue / investigate
                </CardTitle>
                <CardDescription>
                  Ranked from L30 campaign + flow movement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                  <p className="font-medium text-emerald-950">Continue</p>
                  <p className="mt-1 text-emerald-900/90">
                    VIP early-access email — 55% open, strong conversion. Keep
                    cadence.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <p className="font-medium text-amber-950">Investigate</p>
                  <p className="mt-1 text-amber-900/90">
                    Browse Abandon SMS flow −18% WoW revenue; click rate flat —
                    likely offer fatigue.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Module preview
                </CardTitle>
                <CardDescription>
                  Sections shown when data exists for the account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Campaigns",
                    "Flows",
                    "List growth",
                    "Signup forms",
                    "Segments",
                    "Customer Agent",
                    "Reviews",
                    "RFM (if defined)",
                    "Customer Hub (if on)",
                  ].map((item) => (
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
              <CardDescription>
                Customer-stated goals tied to measurable outcomes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  goal: "Grow flow revenue 20% by Q4",
                  progress: 64,
                  detail: "$482K of $750K target · on track",
                },
                {
                  goal: "Cut SMS unsub rate below 0.4%",
                  progress: 40,
                  detail: "Currently 0.52% · needs work",
                },
              ].map((g) => (
                <div key={g.goal} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {g.goal}
                      </p>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        {g.detail}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-[color:var(--ink-soft)]">
                      {g.progress}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--track)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--accent-strong)]"
                      style={{ width: `${g.progress}%` }}
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
                <CardDescription>Tasks in motion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  {
                    title: "Rebuild browse abandon SMS creative",
                    owner: "Alex (CSM)",
                    status: "In progress",
                    icon: Clock3,
                  },
                  {
                    title: "Ship winback flow A/B on subject lines",
                    owner: "Jordan (customer)",
                    status: "Blocked",
                    icon: CircleDashed,
                  },
                  {
                    title: "QA new signup form on PDP",
                    owner: "Sam",
                    status: "Done",
                    icon: CheckCircle2,
                  },
                ].map((t) => (
                  <div
                    key={t.title}
                    className="flex items-start gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    <t.icon className="mt-0.5 size-4 text-[color:var(--ink-muted)]" />
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {t.title}
                      </p>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        {t.owner} · {t.status}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Latest meeting
                </CardTitle>
                <CardDescription>Sep 12, 2026 · QBR</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[color:var(--ink-soft)]">
                <p>
                  Reviewed Labor Day results. Customer wants fewer SMS blasts
                  and more triggered flows. Agreed to pause Saturday SMS promo
                  sends for 2 weeks.
                </p>
                <Separator />
                <p className="font-medium text-[color:var(--ink)]">
                  Next steps
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Deliver SMS cadence proposal by Sep 20</li>
                  <li>Share flow revenue forecast for Q4</li>
                </ul>
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
                {[
                  ["RFM cohort builder export", "On roadmap"],
                  ["SMS quiet hours by segment", "Submitted"],
                ].map(([name, status]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    <span>{name}</span>
                    <Badge variant="secondary" className="rounded-full">
                      {status}
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
                {[
                  ["#48219 Deliverability spike", "P2 · 3d"],
                  ["#48102 Flow filter question", "P3 · 1d"],
                ].map(([name, meta]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    <span>{name}</span>
                    <span className="text-xs text-[color:var(--ink-muted)]">
                      {meta}
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
