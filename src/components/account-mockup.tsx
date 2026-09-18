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
                Executive strip
              </CardTitle>
              <CardDescription>
                Featured pulse — not every window at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Ecom revenue · last 30 days
                  </p>
                  <p className="mt-2 font-heading text-4xl font-semibold tabular-nums text-[color:var(--ink)]">
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
                    Near-term · last 7 days
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                    $286K
                  </p>
                  <div className="mt-2 text-sm">
                    vs prior <Delta value={8.4} suffix="%" />
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Action callout
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]">
                    SMS flow revenue is soft (−18% WoW) while email campaigns are
                    +12% YoY — review SMS cadence before Labor Day follow-ups
                    repeat.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Channel mix · L30 revenue
                  </p>
                  <ShareBar leftLabel="Email" rightLabel="SMS" leftPct={65} />
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Engine mix · L30 revenue
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
                  quarter, YTD — each with prior + YoY.
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
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">vs prior</TableHead>
                        <TableHead className="text-right">YoY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["Yesterday", "$38.2K", 2.1, -1.4],
                        ["Last 7 days", "$286K", 8.4, 9.2],
                        ["MTD", "$612K", -1.2, 14.0],
                        ["Last 30 days", "$1.24M", -4.2, 11.8],
                        ["QTD", "$2.91M", 3.5, 16.2],
                        ["Last quarter", "$3.44M", -0.8, 8.9],
                        ["YTD", "$9.12M", 0, 13.4],
                      ].map(([label, rev, prior, yoy]) => (
                        <TableRow key={String(label)}>
                          <TableCell>{label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {rev}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(prior) === 0 ? (
                              "—"
                            ) : (
                              <Delta value={Number(prior)} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Delta value={Number(yoy)} suffix="%" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
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
