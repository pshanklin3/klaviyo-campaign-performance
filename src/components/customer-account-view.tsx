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
  ExperimentItemType,
  ExperimentMetricCombine,
  ExperimentMetricScope,
  Goal,
  OverviewMetric,
  Task,
} from "@/lib/plan/types";
import {
  EXPERIMENT_ITEM_TYPE_OPTIONS,
  METRIC_COMBINE_OPTIONS,
  METRIC_PRESET_OPTIONS,
  METRIC_SCOPE_OPTIONS,
  applyPresetToPull,
  defaultMetricPull,
  describeMetricWindows,
  ensureExperimentMetricPull,
  presetMeta,
  pullDisplayLabel,
} from "@/lib/plan/experiment-metrics";
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
import { useMemo, useRef, useState } from "react";

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

function ExperimentMetricCard({
  metricLabel,
  benchmarkValue,
  benchmarkNote,
  currentValue,
  currentNote,
  deltaPct,
}: {
  metricLabel: string;
  benchmarkValue: string;
  benchmarkNote: string;
  currentValue: string;
  currentNote: string;
  deltaPct: number;
}) {
  return (
    <div className="grid w-full shrink-0 grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/80 p-3 sm:w-[17.5rem]">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
        Benchmark
      </p>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
        Current
      </p>
      <p className="font-heading text-xl font-semibold leading-none tabular-nums text-[color:var(--ink)]">
        {benchmarkValue || "—"}
      </p>
      <p className="font-heading text-xl font-semibold leading-none tabular-nums text-[color:var(--ink)]">
        {currentValue || "—"}
      </p>
      <p className="min-h-[2.5rem] text-xs leading-snug text-[color:var(--ink-muted)]">
        {metricLabel} · {benchmarkNote}
      </p>
      <p className="min-h-[2.5rem] text-xs leading-snug text-[color:var(--ink-muted)]">
        {currentNote}
      </p>
      <div className="h-5" aria-hidden />
      <div className="flex h-5 items-center text-sm">
        <Delta value={deltaPct} suffix="%" />
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

function hasMetricValue(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v !== "" && v !== "—" && v !== "-" && v !== "–";
}

function MetricCard({ metric }: { metric: OverviewMetric }) {
  if (!hasMetricValue(metric.value)) return null;
  const showYoy = metric.yoyDeltaPct !== 0;
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
        {showYoy ? (
          <span>
            YoY <Delta value={metric.yoyDeltaPct} suffix="%" />
          </span>
        ) : null}
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
  const [plan, setPlan] = useState<CustomerPlan>(() => ({
    ...initialPlan,
    experiments: initialPlan.experiments.map(ensureExperimentMetricPull),
  }));
  const [tab, setTab] = useState<Tab>("performance");
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [showUnlock, setShowUnlock] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStorage, setActiveStorage] = useState(storageMode);
  const experimentsEndRef = useRef<HTMLDivElement | null>(null);
  const pendingRefreshRef = useRef(false);

  const { overview } = plan;

  const exportJson = useMemo(() => JSON.stringify(plan, null, 2), [plan]);

  function updateExperiment(id: string, patch: Partial<Experiment>) {
    setPlan((p) => ({
      ...p,
      experiments: p.experiments.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  }

  function updateMetricPull(
    id: string,
    patch: Partial<Experiment["metricPull"]>,
  ) {
    setPlan((p) => ({
      ...p,
      experiments: p.experiments.map((e) => {
        if (e.id !== id) return e;
        const base = ensureExperimentMetricPull(e);
        const metricPull = { ...base.metricPull, ...patch };
        const windows = describeMetricWindows({
          ...base,
          metricPull,
        });
        return {
          ...base,
          metricPull,
          metricLabel: pullDisplayLabel(metricPull),
          benchmarkNote: windows.benchmark,
          currentNote: windows.current,
        };
      }),
    }));
  }

  function addExperiment() {
    const changedOn = new Date().toISOString().slice(0, 10);
    const metricPull = defaultMetricPull("Flow message");
    const experiment: Experiment = {
      id: newId("exp"),
      name: "New experiment",
      klaviyoUrl: "https://www.klaviyo.com/",
      itemType: "Flow message",
      goal: "Increase click rate",
      implemented: "",
      changedOn,
      metricPull,
      metricLabel: pullDisplayLabel(metricPull),
      benchmarkValue: "—",
      benchmarkNote: `${metricPull.benchmarkDays}d before ${changedOn}`,
      currentValue: "—",
      currentNote: `Since ${changedOn}`,
      deltaPct: 0,
    };
    // Append so "Add another" at the bottom visibly adds below the list.
    setPlan((p) => ({ ...p, experiments: [...p.experiments, experiment] }));
    setStatus("Added experiment — edit the new card, then Save.");
    setError(null);
    requestAnimationFrame(() => {
      experimentsEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
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

  async function refreshMetrics() {
    if (!password.trim()) {
      pendingRefreshRef.current = true;
      setShowUnlock(true);
      setError("Enter the CSM password to refresh metrics.");
      return;
    }
    pendingRefreshRef.current = false;
    setRefreshing(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/customers/${plan.customerId}/metrics/refresh`,
        {
          method: "POST",
          headers: {
            "x-csm-admin-password": password,
          },
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        hint?: string;
        message?: string;
        mode?: "mcp" | "api_key";
        plan?: CustomerPlan;
        storage?: "blob" | "file";
        results?: { id: string; name: string; ok: boolean; detail: string }[];
      } | null;
      if (!response.ok) {
        throw new Error(
          [body?.error, body?.hint].filter(Boolean).join(" — ") ||
            "Refresh failed",
        );
      }
      if (body?.plan) {
        setPlan({
          ...body.plan,
          experiments: body.plan.experiments.map(ensureExperimentMetricPull),
        });
      }
      if (body?.storage) setActiveStorage(body.storage);
      const failed =
        body?.results?.filter((r) => !r.ok).map((r) => r.name) ?? [];
      const okCount = body?.results?.filter((r) => r.ok).length ?? 0;
      setStatus(
        failed.length
          ? `Refreshed overview; experiments: ${okCount} ok, failed: ${failed.join(", ")}`
          : `Refreshed overview and ${okCount} experiment metric(s) from Klaviyo.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function runPrompt() {
    const text = prompt.trim().toLowerCase();
    if (!text) {
      setError("Type a prompt (e.g. refresh metrics) or click Refresh metrics.");
      return;
    }
    if (
      /refresh|update|pull|sync|reload/.test(text) &&
      /metric|overview|data|number|klaviyo|revenue|everything|^refresh/.test(
        text,
      )
    ) {
      setPrompt("");
      void refreshMetrics();
      return;
    }
    if (/^refresh/.test(text) || text === "update" || text === "pull") {
      setPrompt("");
      void refreshMetrics();
      return;
    }
    setError(
      'Try “refresh metrics” or click Refresh metrics. Other prompts aren’t supported yet.',
    );
  }

  async function applyImportedMetrics() {
    if (!password.trim()) {
      setError("Enter the CSM password to import metrics.");
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(importJson);
    } catch {
      setError("Paste valid JSON from Claude (the metrics ingest body).");
      return;
    }
    setImporting(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/customers/${plan.customerId}/metrics/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csm-admin-password": password,
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        hint?: string;
        plan?: CustomerPlan;
        updated?: {
          overview?: boolean;
          experiments?: string[];
          periods?: string[];
          callout?: boolean;
        };
        storage?: "blob" | "file";
      } | null;
      if (!response.ok) {
        throw new Error(
          [body?.error, body?.hint].filter(Boolean).join(" — ") ||
            "Import failed",
        );
      }
      if (body?.plan) {
        setPlan({
          ...body.plan,
          experiments: body.plan.experiments.map(ensureExperimentMetricPull),
        });
      }
      if (body?.storage) setActiveStorage(body.storage);
      const parts = [
        body?.updated?.overview ? "overview" : null,
        body?.updated?.experiments?.length
          ? `${body.updated.experiments.length} experiment(s)`
          : null,
        body?.updated?.periods?.length
          ? `${body.updated.periods.length} period(s)`
          : null,
      ].filter(Boolean);
      setStatus(
        parts.length
          ? `Imported ${parts.join(", ")} from Claude / MCP.`
          : "Metrics imported.",
      );
      setImportJson("");
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
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
      if (body?.plan) {
        setPlan({
          ...body.plan,
          experiments: body.plan.experiments.map(ensureExperimentMetricPull),
        });
      } else {
        setPlan((p) => ({ ...p, syncedAt: new Date().toISOString() }));
      }
      setEditing(false);
      setShowUnlock(false);
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
    if (pendingRefreshRef.current) {
      setStatus("Password accepted — refreshing metrics…");
      void refreshMetrics();
      return;
    }
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
            Account overview metrics stay read-only. Edit unlocks experiments
            (name, goal, change + which Klaviyo metric to pull), continue /
            investigate, and the success plan.
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
            <>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={refreshing}
                onClick={() => void refreshMetrics()}
              >
                {refreshing ? "Refreshing…" : "Refresh metrics"}
              </Button>
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
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={refreshing || saving || importing}
                onClick={() => void refreshMetrics()}
              >
                {refreshing ? "Refreshing…" : "Refresh metrics"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={refreshing || saving || importing}
                onClick={() => {
                  setShowImport(true);
                  setError(null);
                }}
              >
                Import JSON
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
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setEditing(false);
                  setShowUnlock(false);
                  setShowImport(false);
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
              CSM password required to refresh metrics or edit. Default
              locally: <code>klaviyo-csm</code>
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

      {editing && showImport ? (
        <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">
              Import metrics from Claude
            </CardTitle>
            <CardDescription>
              Ask Claude (with Klaviyo MCP) for the metrics JSON only — no
              password. Paste it here and click Apply. Numbers update on this
              page immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className={`${inputClass} min-h-40 font-mono text-xs`}
              placeholder='{ "overview": { … }, "experiments": [ … ] }'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-full"
                disabled={importing || !importJson.trim()}
                onClick={() => void applyImportedMetrics()}
              >
                {importing ? "Applying…" : "Apply metrics"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                disabled={importing}
                onClick={() => {
                  setShowImport(false);
                  setImportJson("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {editing ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)]/95 px-4 py-3 backdrop-blur">
          <p className="mr-auto text-sm text-[color:var(--ink-soft)]">
            Edit cards & success plan · configure metric pull (values not typed)
            · Save → {activeStorage === "blob" ? "Vercel Blob" : "plan.json"}
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
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="text-xs font-medium text-[color:var(--ink-muted)]">
                  Ask the page
                </span>
                <input
                  className={`${inputClass} mt-1`}
                  placeholder='e.g. “refresh metrics”'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runPrompt();
                  }}
                  disabled={refreshing}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={refreshing}
                  onClick={() => runPrompt()}
                >
                  Go
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={refreshing}
                  onClick={() => void refreshMetrics()}
                >
                  {refreshing ? "Refreshing…" : "Refresh metrics"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-xl">
                Account Overview
              </CardTitle>
              <CardDescription>
                Ecom = total Placed Order revenue in Klaviyo. Attributed =
                campaign + flow revenue from Reporting.
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
                  <div
                    className={`mt-3 grid gap-3 ${
                      hasMetricValue(overview.ecomL7.value)
                        ? "grid-cols-2"
                        : "grid-cols-1"
                    }`}
                  >
                    {hasMetricValue(overview.ecomL7.value) ? (
                      <div>
                        <p className="text-xs text-[color:var(--ink-muted)]">
                          Ecom
                        </p>
                        <p className="font-heading text-2xl font-semibold tabular-nums">
                          {overview.ecomL7.value}
                        </p>
                        <div className="mt-1 text-sm">
                          <Delta
                            value={overview.ecomL7.priorDeltaPct}
                            suffix="%"
                          />
                        </div>
                      </div>
                    ) : null}
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
                  Full matrix: Yesterday → YTD attributed (vs prior). YoY when
                  available.
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
                        {plan.periods.some((r) => hasMetricValue(r.ecom)) ? (
                          <>
                            <TableHead className="text-right">Ecom</TableHead>
                            <TableHead className="text-right">
                              Ecom prior
                            </TableHead>
                          </>
                        ) : null}
                        <TableHead className="text-right">Attributed</TableHead>
                        <TableHead className="text-right">Attr prior</TableHead>
                        {plan.periods.some((r) => r.attrYoyPct !== 0) ? (
                          <TableHead className="text-right">Attr YoY</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.periods.map((row) => (
                        <TableRow key={row.window}>
                          <TableCell>{row.window}</TableCell>
                          {plan.periods.some((r) => hasMetricValue(r.ecom)) ? (
                            <>
                              <TableCell className="text-right tabular-nums">
                                {row.ecom}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.ecomPriorPct === 0 ? (
                                  "—"
                                ) : (
                                  <Delta
                                    value={row.ecomPriorPct}
                                    suffix="%"
                                  />
                                )}
                              </TableCell>
                            </>
                          ) : null}
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
                          {plan.periods.some((r) => r.attrYoyPct !== 0) ? (
                            <TableCell className="text-right">
                              <Delta value={row.attrYoyPct} suffix="%" />
                            </TableCell>
                          ) : null}
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
                  Names, goals, and changes are CSM-edited. Numbers refresh with
                  one click (Refresh metrics) or the prompt “refresh metrics” —
                  after KLAVIYO_PRIVATE_API_KEY is set on Vercel.
                  {editing
                    ? " Add / Delete experiments, then Save."
                    : " Click Edit to add or remove experiments."}
                </CardDescription>
              </div>
              {editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addExperiment();
                  }}
                >
                  <Plus className="size-3.5" />
                  Add experiment
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.experiments.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-white/50 px-4 py-6 text-center">
                  <p className="text-sm text-[color:var(--ink-soft)]">
                    No experiments yet.
                  </p>
                  {editing ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addExperiment();
                      }}
                    >
                      <Plus className="size-3.5" />
                      Add experiment
                    </Button>
                  ) : (
                    <p className="text-xs text-[color:var(--ink-muted)]">
                      Click Edit (top right) to add one.
                    </p>
                  )}
                </div>
              ) : (
                plan.experiments.map((raw) => {
                  const item = ensureExperimentMetricPull(raw);
                  const pull = item.metricPull;
                  const windows = describeMetricWindows(item);
                  return (
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
                                onChange={(e) => {
                                  const itemType = e.target
                                    .value as ExperimentItemType;
                                  const nextPull = defaultMetricPull(itemType);
                                  updateExperiment(item.id, { itemType });
                                  updateMetricPull(item.id, {
                                    scope: nextPull.scope,
                                  });
                                }}
                              >
                                {EXPERIMENT_ITEM_TYPE_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1 text-xs text-[color:var(--ink-muted)]">
                                Changed
                                <input
                                  type="date"
                                  className={`${inputClass} w-40`}
                                  value={item.changedOn}
                                  onChange={(e) =>
                                    updateExperiment(item.id, {
                                      changedOn: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full text-rose-700"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Delete experiment “${item.name}”?`,
                                    )
                                  ) {
                                    return;
                                  }
                                  setPlan((p) => ({
                                    ...p,
                                    experiments: p.experiments.filter(
                                      (e) => e.id !== item.id,
                                    ),
                                  }));
                                }}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
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
                            <div className="space-y-2 rounded-xl border border-dashed border-[color:var(--panel-border)] bg-[color:var(--panel)]/60 p-3">
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                                Goal metric (any metric or aggregate)
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="space-y-1 text-xs">
                                  <span className="text-[color:var(--ink-muted)]">
                                    Source object
                                  </span>
                                  <select
                                    className={inputClass}
                                    value={pull.scope}
                                    onChange={(e) =>
                                      updateMetricPull(item.id, {
                                        scope: e.target
                                          .value as ExperimentMetricScope,
                                      })
                                    }
                                  >
                                    {METRIC_SCOPE_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="text-[color:var(--ink-muted)]">
                                    Preset shortcut
                                  </span>
                                  <select
                                    className={inputClass}
                                    value={
                                      METRIC_PRESET_OPTIONS.some(
                                        (o) => o.value === pull.preset,
                                      )
                                        ? pull.preset
                                        : "custom"
                                    }
                                    onChange={(e) => {
                                      const next = applyPresetToPull(
                                        pull,
                                        e.target.value,
                                      );
                                      updateMetricPull(item.id, next);
                                    }}
                                  >
                                    {METRIC_PRESET_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs sm:col-span-2">
                                  <span className="text-[color:var(--ink-muted)]">
                                    Goal metric label
                                  </span>
                                  <input
                                    className={inputClass}
                                    value={pull.goalMetricLabel}
                                    onChange={(e) =>
                                      updateMetricPull(item.id, {
                                        preset: "custom",
                                        goalMetricLabel: e.target.value,
                                      })
                                    }
                                    placeholder="e.g. Email + SMS attributed revenue"
                                  />
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="text-[color:var(--ink-muted)]">
                                    How metrics combine
                                  </span>
                                  <select
                                    className={inputClass}
                                    value={pull.combine}
                                    onChange={(e) =>
                                      updateMetricPull(item.id, {
                                        combine: e.target
                                          .value as ExperimentMetricCombine,
                                        preset:
                                          e.target.value === "single"
                                            ? pull.preset
                                            : "custom",
                                      })
                                    }
                                  >
                                    {METRIC_COMBINE_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="text-[color:var(--ink-muted)]">
                                    Klaviyo object ID
                                  </span>
                                  <input
                                    className={inputClass}
                                    value={pull.objectId}
                                    onChange={(e) =>
                                      updateMetricPull(item.id, {
                                        objectId: e.target.value,
                                      })
                                    }
                                    placeholder="Message / flow / campaign / form id"
                                  />
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="text-[color:var(--ink-muted)]">
                                    Benchmark days before change
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    className={inputClass}
                                    value={pull.benchmarkDays}
                                    onChange={(e) =>
                                      updateMetricPull(item.id, {
                                        benchmarkDays:
                                          Number(e.target.value) || 30,
                                      })
                                    }
                                  />
                                </label>
                                {pull.combine === "custom" ||
                                pull.combine === "ratio" ||
                                pull.combine === "sum" ||
                                pull.combine === "average" ? (
                                  <label className="space-y-1 text-xs sm:col-span-2">
                                    <span className="text-[color:var(--ink-muted)]">
                                      Formula / notes
                                    </span>
                                    <input
                                      className={inputClass}
                                      value={pull.combineNote ?? ""}
                                      onChange={(e) =>
                                        updateMetricPull(item.id, {
                                          combineNote: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. Placed Order (email) + Placed Order (SMS)"
                                    />
                                  </label>
                                ) : null}
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-[color:var(--ink-muted)]">
                                    Metric(s) in this goal
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() =>
                                      updateMetricPull(item.id, {
                                        preset: "custom",
                                        metrics: [
                                          ...pull.metrics,
                                          { label: "", metricId: "" },
                                        ],
                                        combine:
                                          pull.metrics.length >= 1 &&
                                          pull.combine === "single"
                                            ? "sum"
                                            : pull.combine,
                                      })
                                    }
                                  >
                                    <Plus className="size-3.5" />
                                    Add metric
                                  </Button>
                                </div>
                                {pull.metrics.map((ref, idx) => (
                                  <div
                                    key={`${item.id}-m-${idx}`}
                                    className="flex flex-col gap-2 sm:flex-row"
                                  >
                                    <input
                                      className={inputClass}
                                      value={ref.label}
                                      onChange={(e) => {
                                        const metrics = pull.metrics.map(
                                          (m, i) =>
                                            i === idx
                                              ? { ...m, label: e.target.value }
                                              : m,
                                        );
                                        updateMetricPull(item.id, {
                                          preset: "custom",
                                          metrics,
                                          goalMetricLabel:
                                            pull.combine === "single" &&
                                            metrics[0]
                                              ? metrics[0].label
                                              : pull.goalMetricLabel,
                                        });
                                      }}
                                      placeholder="Event metric name (e.g. Clicked Email)"
                                    />
                                    <input
                                      className={inputClass}
                                      value={ref.metricId ?? ""}
                                      onChange={(e) => {
                                        const metrics = pull.metrics.map(
                                          (m, i) =>
                                            i === idx
                                              ? {
                                                  ...m,
                                                  metricId: e.target.value,
                                                }
                                              : m,
                                        );
                                        updateMetricPull(item.id, {
                                          preset: "custom",
                                          metrics,
                                        });
                                      }}
                                      placeholder="Event metric ID (Clicked… — not click rate)"
                                    />
                                    {pull.metrics.length > 1 ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-rose-700"
                                        onClick={() =>
                                          updateMetricPull(item.id, {
                                            metrics: pull.metrics.filter(
                                              (_, i) => i !== idx,
                                            ),
                                          })
                                        }
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-[color:var(--ink-soft)]">
                                {
                                  METRIC_SCOPE_OPTIONS.find(
                                    (o) => o.value === pull.scope,
                                  )?.hint
                                }{" "}
                                · Windows: {windows.benchmark} →{" "}
                                {windows.current}.
                                {presetMeta(pull.preset)?.derived
                                  ? ` “${pullDisplayLabel(pull)}” is derived — use the underlying event metric ID (${presetMeta(pull.preset)?.eventHints.join(" / ")}), not a rate ID.`
                                  : " Paste a Klaviyo event metric ID when you have one; rates like click rate have none."}
                              </p>
                              <label className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                                <input
                                  type="checkbox"
                                  checked={pull.autoPull}
                                  onChange={(e) =>
                                    updateMetricPull(item.id, {
                                      autoPull: e.target.checked,
                                    })
                                  }
                                />
                                Auto-pull values (uncheck only for temporary
                                manual override)
                              </label>
                              {!pull.autoPull ? (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <input
                                    className={inputClass}
                                    value={item.benchmarkValue}
                                    onChange={(e) =>
                                      updateExperiment(item.id, {
                                        benchmarkValue: e.target.value,
                                      })
                                    }
                                    placeholder="Benchmark value"
                                  />
                                  <input
                                    className={inputClass}
                                    value={item.currentValue}
                                    onChange={(e) =>
                                      updateExperiment(item.id, {
                                        currentValue: e.target.value,
                                      })
                                    }
                                    placeholder="Current value"
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
                                    placeholder="Delta %"
                                  />
                                </div>
                              ) : null}
                            </div>
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
                      <ExperimentMetricCard
                        metricLabel={item.metricLabel}
                        benchmarkValue={item.benchmarkValue}
                        benchmarkNote={item.benchmarkNote}
                        currentValue={item.currentValue}
                        currentNote={item.currentNote}
                        deltaPct={item.deltaPct}
                      />
                    </div>
                  </div>
                  );
                })
              )}
              {editing && plan.experiments.length > 0 ? (
                <div ref={experimentsEndRef}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addExperiment();
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add another experiment
                  </Button>
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
