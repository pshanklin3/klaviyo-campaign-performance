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
import type {
  CustomerPlan,
  Experiment,
  Goal,
  OverviewMetric,
  Task,
} from "@/lib/plan/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "performance" | "success";

const inputClass =
  "w-full rounded-lg border border-[color:var(--panel-border)] bg-white px-2.5 py-1.5 text-sm text-[color:var(--ink)] outline-none focus:ring-2 focus:ring-[color:var(--accent-strong)]";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

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

function MetricCard({
  metric,
  editing,
  onChange,
}: {
  metric: OverviewMetric;
  editing: boolean;
  onChange?: (patch: Partial<OverviewMetric>) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
      {editing ? (
        <input
          className={inputClass}
          value={metric.label}
          onChange={(e) => onChange?.({ label: e.target.value })}
        />
      ) : (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
          {metric.label}
        </p>
      )}
      {editing ? (
        <input
          className={`${inputClass} mt-2 font-heading text-2xl font-semibold`}
          value={metric.value}
          onChange={(e) => onChange?.({ value: e.target.value })}
        />
      ) : (
        <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[color:var(--ink)] sm:text-4xl">
          {metric.value}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {editing ? (
          <>
            <label className="flex items-center gap-1 text-xs">
              prior %
              <input
                type="number"
                step="0.1"
                className={`${inputClass} w-20`}
                value={metric.priorDeltaPct}
                onChange={(e) =>
                  onChange?.({ priorDeltaPct: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              YoY %
              <input
                type="number"
                step="0.1"
                className={`${inputClass} w-20`}
                value={metric.yoyDeltaPct}
                onChange={(e) =>
                  onChange?.({ yoyDeltaPct: Number(e.target.value) || 0 })
                }
              />
            </label>
          </>
        ) : (
          <>
            <span>
              vs prior <Delta value={metric.priorDeltaPct} suffix="%" />
            </span>
            <span>
              YoY <Delta value={metric.yoyDeltaPct} suffix="%" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function CustomerAccountView({
  initialPlan,
  storageMode,
  defaultPassword = "",
  startEditing = false,
}: {
  initialPlan: CustomerPlan;
  storageMode: "blob" | "file";
  defaultPassword?: string;
  startEditing?: boolean;
}) {
  const [plan, setPlan] = useState<CustomerPlan>(initialPlan);
  const [tab, setTab] = useState<Tab>("performance");
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [showUnlock, setShowUnlock] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStorage, setActiveStorage] = useState(storageMode);

  const { overview } = plan;

  const exportJson = useMemo(() => JSON.stringify(plan, null, 2), [plan]);

  function patchOverview(
    key: keyof CustomerPlan["overview"],
    patch: Partial<OverviewMetric> | number,
  ) {
    setPlan((p) => {
      if (key === "emailSharePct" || key === "campaignSharePct") {
        return {
          ...p,
          overview: { ...p.overview, [key]: patch as number },
        };
      }
      const current = p.overview[key] as OverviewMetric;
      return {
        ...p,
        overview: {
          ...p.overview,
          [key]: { ...current, ...(patch as Partial<OverviewMetric>) },
        },
      };
    });
  }

  function updateExperiment(id: string, patch: Partial<Experiment>) {
    setPlan((p) => ({
      ...p,
      experiments: p.experiments.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  }

  function addExperiment() {
    const experiment: Experiment = {
      id: newId("exp"),
      name: "New experiment",
      klaviyoUrl: "https://www.klaviyo.com/",
      itemType: "Flow message",
      goal: "Increase click rate",
      implemented: "",
      changedOn: new Date().toISOString().slice(0, 10),
      metricLabel: "Click rate",
      benchmarkValue: "",
      benchmarkNote: "L30 before change",
      currentValue: "",
      currentNote: "Since change",
      deltaPct: 0,
    };
    setPlan((p) => ({ ...p, experiments: [experiment, ...p.experiments] }));
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    setPlan((p) => ({
      ...p,
      goals: p.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function addGoal() {
    setPlan((p) => ({
      ...p,
      goals: [
        ...p.goals,
        {
          id: newId("goal"),
          statement: "New goal",
          progressPct: 0,
          detail: "",
        },
      ],
    }));
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setPlan((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/customers/${plan.customerId}/plan`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csm-admin-password": password,
        },
        body: JSON.stringify({
          ...plan,
          syncedAt: new Date().toISOString(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        hint?: string;
        storage?: "blob" | "file";
        plan?: CustomerPlan;
      } | null;
      if (!response.ok) {
        throw new Error(
          [body?.error, body?.hint].filter(Boolean).join(" — ") ||
            "Save failed",
        );
      }
      if (body?.storage) setActiveStorage(body.storage);
      if (body?.plan) setPlan(body.plan);
      else setPlan((p) => ({ ...p, syncedAt: new Date().toISOString() }));
      setStatus(
        body?.storage === "blob"
          ? "Saved to Vercel Blob."
          : "Saved to local plan.json.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function unlock() {
    if (!password.trim()) {
      setError("Enter the CSM password to edit.");
      return;
    }
    setEditing(true);
    setShowUnlock(false);
    setError(null);
    setStatus("Editing unlocked — change fields on this page, then Save.");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {editing ? "Editing" : "Account"}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Synced {formatSyncedAt(plan.syncedAt)}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {activeStorage === "blob" ? "Blob" : "File"} storage
            </Badge>
          </div>
          {editing ? (
            <input
              className={`${inputClass} font-heading text-3xl font-semibold`}
              value={plan.displayName}
              onChange={(e) =>
                setPlan((p) => ({ ...p, displayName: e.target.value }))
              }
            />
          ) : (
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
              {plan.displayName}
            </h1>
          )}
          <p className="max-w-2xl text-sm text-[color:var(--ink-soft)]">
            Account health + success plan. Click Edit to change fields on this
            page, then Save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setShowUnlock(true);
                setError(null);
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setEditing(false);
                  setShowUnlock(false);
                  setStatus(null);
                }}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </header>

      {showUnlock && !editing ? (
        <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Unlock editing</CardTitle>
            <CardDescription>
              CSM password required to edit and save. Default locally:{" "}
              <code>klaviyo-csm</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-xs font-medium text-[color:var(--ink-muted)]">
                Password
              </span>
              <input
                type="password"
                className={`${inputClass} mt-1`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlock();
                }}
              />
            </label>
            <Button type="button" className="rounded-full" onClick={unlock}>
              Unlock
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setShowUnlock(false)}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {editing ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/95 px-4 py-3 backdrop-blur">
          <p className="mr-auto text-sm text-[color:var(--ink-soft)]">
            Editing on this page · Save writes to{" "}
            {activeStorage === "blob" ? "Vercel Blob" : "plan.json"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(exportJson);
              setStatus("JSON copied.");
            }}
          >
            Copy JSON
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}

      {status ? (
        <p className="text-sm text-emerald-800">{status}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-800">{error}</p> : null}

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
                <MetricCard
                  metric={overview.ecomL30}
                  editing={editing}
                  onChange={(patch) => patchOverview("ecomL30", patch)}
                />
                <MetricCard
                  metric={overview.ecomYesterday}
                  editing={editing}
                  onChange={(patch) => patchOverview("ecomYesterday", patch)}
                />
                <MetricCard
                  metric={overview.attributedL30}
                  editing={editing}
                  onChange={(patch) => patchOverview("attributedL30", patch)}
                />
                <MetricCard
                  metric={overview.attributedYesterday}
                  editing={editing}
                  onChange={(patch) =>
                    patchOverview("attributedYesterday", patch)
                  }
                />
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
                      {editing ? (
                        <input
                          className={inputClass}
                          value={overview.ecomL7.value}
                          onChange={(e) =>
                            patchOverview("ecomL7", { value: e.target.value })
                          }
                        />
                      ) : (
                        <p className="font-heading text-2xl font-semibold tabular-nums">
                          {overview.ecomL7.value}
                        </p>
                      )}
                      {!editing ? (
                        <div className="mt-1 text-sm">
                          <Delta
                            value={overview.ecomL7.priorDeltaPct}
                            suffix="%"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--ink-muted)]">
                        Attributed
                      </p>
                      {editing ? (
                        <input
                          className={inputClass}
                          value={overview.attributedL7.value}
                          onChange={(e) =>
                            patchOverview("attributedL7", {
                              value: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <p className="font-heading text-2xl font-semibold tabular-nums">
                          {overview.attributedL7.value}
                        </p>
                      )}
                      {!editing ? (
                        <div className="mt-1 text-sm">
                          <Delta
                            value={overview.attributedL7.priorDeltaPct}
                            suffix="%"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                    Action callout
                  </p>
                  {editing ? (
                    <textarea
                      className={`${inputClass} mt-3 min-h-24`}
                      value={plan.callout}
                      onChange={(e) =>
                        setPlan((p) => ({ ...p, callout: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]">
                      {plan.callout || "No callout yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Channel mix · L30 attributed revenue
                  </p>
                  {editing ? (
                    <label className="flex items-center gap-2 text-sm">
                      Email %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={`${inputClass} w-24`}
                        value={overview.emailSharePct}
                        onChange={(e) =>
                          patchOverview(
                            "emailSharePct",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </label>
                  ) : (
                    <ShareBar
                      leftLabel="Email"
                      rightLabel="SMS"
                      leftPct={overview.emailSharePct}
                    />
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">
                    Engine mix · L30 attributed revenue
                  </p>
                  {editing ? (
                    <label className="flex items-center gap-2 text-sm">
                      Campaigns %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={`${inputClass} w-24`}
                        value={overview.campaignSharePct}
                        onChange={(e) =>
                          patchOverview(
                            "campaignSharePct",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </label>
                  ) : (
                    <ShareBar
                      leftLabel="Campaigns"
                      rightLabel="Flows"
                      leftPct={overview.campaignSharePct}
                    />
                  )}
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
                      {plan.periods.map((row, idx) => (
                        <TableRow key={row.window}>
                          <TableCell>{row.window}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {editing ? (
                              <input
                                className={`${inputClass} text-right`}
                                value={row.ecom}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? { ...r, ecom: e.target.value }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : (
                              row.ecom
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <input
                                type="number"
                                step="0.1"
                                className={`${inputClass} text-right`}
                                value={row.ecomPriorPct}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ecomPriorPct:
                                              Number(e.target.value) || 0,
                                          }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : row.ecomPriorPct === 0 ? (
                              "—"
                            ) : (
                              <Delta value={row.ecomPriorPct} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <input
                                type="number"
                                step="0.1"
                                className={`${inputClass} text-right`}
                                value={row.ecomYoyPct}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ecomYoyPct:
                                              Number(e.target.value) || 0,
                                          }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : (
                              <Delta value={row.ecomYoyPct} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {editing ? (
                              <input
                                className={`${inputClass} text-right`}
                                value={row.attributed}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? { ...r, attributed: e.target.value }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : (
                              row.attributed
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <input
                                type="number"
                                step="0.1"
                                className={`${inputClass} text-right`}
                                value={row.attrPriorPct}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            attrPriorPct:
                                              Number(e.target.value) || 0,
                                          }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : row.attrPriorPct === 0 ? (
                              "—"
                            ) : (
                              <Delta value={row.attrPriorPct} suffix="%" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <input
                                type="number"
                                step="0.1"
                                className={`${inputClass} text-right`}
                                value={row.attrYoyPct}
                                onChange={(e) =>
                                  setPlan((p) => ({
                                    ...p,
                                    periods: p.periods.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            attrYoyPct:
                                              Number(e.target.value) || 0,
                                          }
                                        : r,
                                    ),
                                  }))
                                }
                              />
                            ) : (
                              <Delta value={row.attrYoyPct} suffix="%" />
                            )}
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
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="font-heading text-xl">
                  In motion · performance experiments
                </CardTitle>
                <CardDescription>
                  Active work — benchmark before the change vs current since
                  go-live
                </CardDescription>
              </div>
              {editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={addExperiment}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.experiments.length === 0 ? (
                <p className="text-sm text-[color:var(--ink-soft)]">
                  No experiments yet.
                  {editing ? " Click Add to create one." : " Click Edit to add."}
                </p>
              ) : (
                plan.experiments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {editing ? (
                            <>
                              <select
                                className={inputClass}
                                value={item.itemType}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    itemType: e.target
                                      .value as Experiment["itemType"],
                                  })
                                }
                              >
                                <option>Flow message</option>
                                <option>Campaign</option>
                                <option>Form</option>
                                <option>Other</option>
                              </select>
                              <input
                                className={`${inputClass} w-36`}
                                value={item.changedOn}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    changedOn: e.target.value,
                                  })
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="rounded-full text-rose-700"
                                onClick={() =>
                                  setPlan((p) => ({
                                    ...p,
                                    experiments: p.experiments.filter(
                                      (e) => e.id !== item.id,
                                    ),
                                  }))
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                {item.itemType}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                Since {item.changedOn}
                              </Badge>
                            </>
                          )}
                        </div>
                        {editing ? (
                          <>
                            <input
                              className={`${inputClass} font-heading text-lg font-semibold`}
                              value={item.name}
                              onChange={(e) =>
                                updateExperiment(item.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                            <input
                              className={inputClass}
                              value={item.klaviyoUrl}
                              onChange={(e) =>
                                updateExperiment(item.id, {
                                  klaviyoUrl: e.target.value,
                                })
                              }
                              placeholder="Klaviyo URL"
                            />
                            <input
                              className={inputClass}
                              value={item.goal}
                              onChange={(e) =>
                                updateExperiment(item.id, {
                                  goal: e.target.value,
                                })
                              }
                              placeholder="Goal"
                            />
                            <input
                              className={inputClass}
                              value={item.implemented}
                              onChange={(e) =>
                                updateExperiment(item.id, {
                                  implemented: e.target.value,
                                })
                              }
                              placeholder="Implemented change"
                            />
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                      <div className="grid min-w-[220px] grid-cols-2 gap-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/80 p-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                            Benchmark
                          </p>
                          {editing ? (
                            <>
                              <input
                                className={inputClass}
                                value={item.benchmarkValue}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    benchmarkValue: e.target.value,
                                  })
                                }
                              />
                              <input
                                className={inputClass}
                                value={item.metricLabel}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    metricLabel: e.target.value,
                                  })
                                }
                                placeholder="Metric"
                              />
                              <input
                                className={inputClass}
                                value={item.benchmarkNote}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    benchmarkNote: e.target.value,
                                  })
                                }
                              />
                            </>
                          ) : (
                            <>
                              <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                                {item.benchmarkValue}
                              </p>
                              <p className="text-xs text-[color:var(--ink-muted)]">
                                {item.metricLabel} · {item.benchmarkNote}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                            Current
                          </p>
                          {editing ? (
                            <>
                              <input
                                className={inputClass}
                                value={item.currentValue}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    currentValue: e.target.value,
                                  })
                                }
                              />
                              <input
                                className={inputClass}
                                value={item.currentNote}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    currentNote: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="number"
                                step="0.1"
                                className={inputClass}
                                value={item.deltaPct}
                                onChange={(e) =>
                                  updateExperiment(item.id, {
                                    deltaPct: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </>
                          ) : (
                            <>
                              <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                                {item.currentValue}
                              </p>
                              <p className="text-xs text-[color:var(--ink-muted)]">
                                {item.currentNote}
                              </p>
                              <div className="mt-1 text-sm">
                                <Delta value={item.deltaPct} suffix="%" />
                              </div>
                            </>
                          )}
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
                {plan.continueItems.map((text, idx) => (
                  <div
                    key={`c-${idx}`}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-emerald-950">Continue</p>
                    {editing ? (
                      <div className="mt-1 flex gap-2">
                        <textarea
                          className={`${inputClass} min-h-16`}
                          value={text}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              continueItems: p.continueItems.map((t, i) =>
                                i === idx ? e.target.value : t,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setPlan((p) => ({
                              ...p,
                              continueItems: p.continueItems.filter(
                                (_, i) => i !== idx,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-emerald-900/90">{text}</p>
                    )}
                  </div>
                ))}
                {plan.investigateItems.map((text, idx) => (
                  <div
                    key={`i-${idx}`}
                    className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-amber-950">Investigate</p>
                    {editing ? (
                      <div className="mt-1 flex gap-2">
                        <textarea
                          className={`${inputClass} min-h-16`}
                          value={text}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              investigateItems: p.investigateItems.map(
                                (t, i) => (i === idx ? e.target.value : t),
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setPlan((p) => ({
                              ...p,
                              investigateItems: p.investigateItems.filter(
                                (_, i) => i !== idx,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-amber-900/90">{text}</p>
                    )}
                  </div>
                ))}
                {editing ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          continueItems: [...p.continueItems, "New continue item"],
                        }))
                      }
                    >
                      Add continue
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          investigateItems: [
                            ...p.investigateItems,
                            "New investigate item",
                          ],
                        }))
                      }
                    >
                      Add investigate
                    </Button>
                  </div>
                ) : null}
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
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="font-heading text-xl">
                Goals & progress
              </CardTitle>
              {editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={addGoal}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.goals.map((g) => (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      {editing ? (
                        <>
                          <input
                            className={inputClass}
                            value={g.statement}
                            onChange={(e) =>
                              updateGoal(g.id, { statement: e.target.value })
                            }
                          />
                          <input
                            className={inputClass}
                            value={g.detail}
                            onChange={(e) =>
                              updateGoal(g.id, { detail: e.target.value })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-[color:var(--ink)]">
                            {g.statement}
                          </p>
                          <p className="text-xs text-[color:var(--ink-muted)]">
                            {g.detail}
                          </p>
                        </>
                      )}
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={`${inputClass} w-20`}
                          value={g.progressPct}
                          onChange={(e) =>
                            updateGoal(g.id, {
                              progressPct: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-700"
                          onClick={() =>
                            setPlan((p) => ({
                              ...p,
                              goals: p.goals.filter((x) => x.id !== g.id),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums text-[color:var(--ink-soft)]">
                        {g.progressPct}%
                      </span>
                    )}
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
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="font-heading text-lg">
                  Action plan
                </CardTitle>
                {editing ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      setPlan((p) => ({
                        ...p,
                        tasks: [
                          ...p.tasks,
                          {
                            id: newId("task"),
                            title: "New task",
                            owner: "",
                            status: "In progress",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                ) : null}
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
                      <Icon className="mt-0.5 size-4 shrink-0 text-[color:var(--ink-muted)]" />
                      {editing ? (
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <input
                            className={inputClass}
                            value={t.title}
                            onChange={(e) =>
                              updateTask(t.id, { title: e.target.value })
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            <input
                              className={`${inputClass} flex-1`}
                              value={t.owner}
                              onChange={(e) =>
                                updateTask(t.id, { owner: e.target.value })
                              }
                              placeholder="Owner"
                            />
                            <select
                              className={inputClass}
                              value={t.status}
                              onChange={(e) =>
                                updateTask(t.id, {
                                  status: e.target.value as Task["status"],
                                })
                              }
                            >
                              <option>In progress</option>
                              <option>Blocked</option>
                              <option>Done</option>
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-rose-700"
                              onClick={() =>
                                setPlan((p) => ({
                                  ...p,
                                  tasks: p.tasks.filter((x) => x.id !== t.id),
                                }))
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-[color:var(--ink)]">
                            {t.title}
                          </p>
                          <p className="text-xs text-[color:var(--ink-muted)]">
                            {t.owner} · {t.status}
                          </p>
                        </div>
                      )}
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
                {!editing ? (
                  <CardDescription>
                    {plan.meeting
                      ? `${plan.meeting.date} · ${plan.meeting.title}`
                      : "No meeting logged"}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[color:var(--ink-soft)]">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={plan.meeting?.date ?? ""}
                      onChange={(e) =>
                        setPlan((p) => ({
                          ...p,
                          meeting: {
                            id: p.meeting?.id ?? newId("mtg"),
                            date: e.target.value,
                            title: p.meeting?.title ?? "Meeting",
                            summary: p.meeting?.summary ?? "",
                            nextSteps: p.meeting?.nextSteps ?? [],
                          },
                        }))
                      }
                      placeholder="Date"
                    />
                    <input
                      className={inputClass}
                      value={plan.meeting?.title ?? ""}
                      onChange={(e) =>
                        setPlan((p) => ({
                          ...p,
                          meeting: {
                            id: p.meeting?.id ?? newId("mtg"),
                            date:
                              p.meeting?.date ??
                              new Date().toISOString().slice(0, 10),
                            title: e.target.value,
                            summary: p.meeting?.summary ?? "",
                            nextSteps: p.meeting?.nextSteps ?? [],
                          },
                        }))
                      }
                      placeholder="Title"
                    />
                    <textarea
                      className={`${inputClass} min-h-24`}
                      value={plan.meeting?.summary ?? ""}
                      onChange={(e) =>
                        setPlan((p) => ({
                          ...p,
                          meeting: {
                            id: p.meeting?.id ?? newId("mtg"),
                            date:
                              p.meeting?.date ??
                              new Date().toISOString().slice(0, 10),
                            title: p.meeting?.title ?? "Meeting",
                            summary: e.target.value,
                            nextSteps: p.meeting?.nextSteps ?? [],
                          },
                        }))
                      }
                      placeholder="Summary"
                    />
                    <textarea
                      className={`${inputClass} min-h-20`}
                      value={(plan.meeting?.nextSteps ?? []).join("\n")}
                      onChange={(e) =>
                        setPlan((p) => ({
                          ...p,
                          meeting: {
                            id: p.meeting?.id ?? newId("mtg"),
                            date:
                              p.meeting?.date ??
                              new Date().toISOString().slice(0, 10),
                            title: p.meeting?.title ?? "Meeting",
                            summary: p.meeting?.summary ?? "",
                            nextSteps: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      placeholder="Next steps (one per line)"
                    />
                  </div>
                ) : plan.meeting ? (
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
                  <p>No meeting logged yet. Click Edit to add one.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="font-heading text-lg">
                  Product requests
                </CardTitle>
                {editing ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      setPlan((p) => ({
                        ...p,
                        productRequests: [
                          ...p.productRequests,
                          {
                            id: newId("pr"),
                            name: "New request",
                            status: "Submitted",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {plan.productRequests.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    {editing ? (
                      <>
                        <input
                          className={inputClass}
                          value={item.name}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              productRequests: p.productRequests.map((r) =>
                                r.id === item.id
                                  ? { ...r, name: e.target.value }
                                  : r,
                              ),
                            }))
                          }
                        />
                        <input
                          className={`${inputClass} w-40`}
                          value={item.status}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              productRequests: p.productRequests.map((r) =>
                                r.id === item.id
                                  ? { ...r, status: e.target.value }
                                  : r,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-700"
                          onClick={() =>
                            setPlan((p) => ({
                              ...p,
                              productRequests: p.productRequests.filter(
                                (r) => r.id !== item.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span>{item.name}</span>
                        <Badge variant="secondary" className="rounded-full">
                          {item.status}
                        </Badge>
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="font-heading text-lg">
                  Zendesk in progress
                </CardTitle>
                {editing ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      setPlan((p) => ({
                        ...p,
                        tickets: [
                          ...p.tickets,
                          {
                            id: newId("zd"),
                            title: "#00000 Ticket",
                            meta: "P3 · 1d",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {plan.tickets.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/60 px-3 py-2"
                  >
                    {editing ? (
                      <>
                        <input
                          className={inputClass}
                          value={item.title}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              tickets: p.tickets.map((t) =>
                                t.id === item.id
                                  ? { ...t, title: e.target.value }
                                  : t,
                              ),
                            }))
                          }
                        />
                        <input
                          className={`${inputClass} w-28`}
                          value={item.meta}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              tickets: p.tickets.map((t) =>
                                t.id === item.id
                                  ? { ...t, meta: e.target.value }
                                  : t,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-700"
                          onClick={() =>
                            setPlan((p) => ({
                              ...p,
                              tickets: p.tickets.filter(
                                (t) => t.id !== item.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span>{item.title}</span>
                        <span className="text-xs text-[color:var(--ink-muted)]">
                          {item.meta}
                        </span>
                      </>
                    )}
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
