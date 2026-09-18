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
import type {
  CustomerPlan,
  Experiment,
  Goal,
  MeetingNote,
  ProductRequest,
  SupportTicket,
  Task,
} from "@/lib/plan/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const fieldClass =
  "mt-1 w-full rounded-lg border border-[color:var(--panel-border)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] outline-none focus:ring-2 focus:ring-[color:var(--accent-strong)]";

const labelClass = "text-xs font-medium text-[color:var(--ink-muted)]";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AdminPlanEditor({
  initialPlan,
  defaultPassword,
}: {
  initialPlan: CustomerPlan;
  defaultPassword: string;
}) {
  const [plan, setPlan] = useState<CustomerPlan>(initialPlan);
  const [password, setPassword] = useState(defaultPassword);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportJson = useMemo(() => JSON.stringify(plan, null, 2), [plan]);

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
      } | null;
      if (!response.ok) {
        throw new Error(
          [body?.error, body?.hint].filter(Boolean).join(" — ") ||
            "Save failed",
        );
      }
      setStatus("Saved. Customer page will show these updates after refresh.");
      setPlan((p) => ({ ...p, syncedAt: new Date().toISOString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
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

  function removeExperiment(id: string) {
    setPlan((p) => ({
      ...p,
      experiments: p.experiments.filter((e) => e.id !== id),
    }));
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    setPlan((p) => ({
      ...p,
      goals: p.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function addGoal() {
    const goal: Goal = {
      id: newId("goal"),
      statement: "New goal",
      progressPct: 0,
      detail: "",
    };
    setPlan((p) => ({ ...p, goals: [...p.goals, goal] }));
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setPlan((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function addTask() {
    const task: Task = {
      id: newId("task"),
      title: "New task",
      owner: "",
      status: "In progress",
    };
    setPlan((p) => ({ ...p, tasks: [...p.tasks, task] }));
  }

  function updateMeeting(patch: Partial<MeetingNote>) {
    setPlan((p) => ({
      ...p,
      meeting: p.meeting
        ? { ...p.meeting, ...patch }
        : {
            id: newId("mtg"),
            date: new Date().toISOString().slice(0, 10),
            title: "Meeting",
            summary: "",
            nextSteps: [],
            ...patch,
          },
    }));
  }

  function updateProductRequest(id: string, patch: Partial<ProductRequest>) {
    setPlan((p) => ({
      ...p,
      productRequests: p.productRequests.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
  }

  function addProductRequest() {
    const item: ProductRequest = {
      id: newId("pr"),
      name: "New request",
      status: "Submitted",
    };
    setPlan((p) => ({
      ...p,
      productRequests: [...p.productRequests, item],
    }));
  }

  function updateTicket(id: string, patch: Partial<SupportTicket>) {
    setPlan((p) => ({
      ...p,
      tickets: p.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function addTicket() {
    const item: SupportTicket = {
      id: newId("zd"),
      title: "#00000 Ticket",
      meta: "P3 · 1d",
    };
    setPlan((p) => ({ ...p, tickets: [...p.tickets, item] }));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <Badge variant="secondary" className="rounded-full">
          CSM admin
        </Badge>
        <h1 className="font-heading text-3xl font-semibold text-[color:var(--ink)]">
          Edit · {plan.displayName}
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--ink-soft)]">
          Update experiments, goals, meetings, and other success-plan fields.
          Customer view is read-only at{" "}
          <Link
            href={`/c/${plan.customerId}`}
            className="font-medium text-[color:var(--accent-strong)] underline-offset-4 hover:underline"
          >
            /c/{plan.customerId}
          </Link>
          .
        </p>
      </header>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Save</CardTitle>
          <CardDescription>
            Default local password is <code>klaviyo-csm</code>. Override with{" "}
            <code>CSM_ADMIN_PASSWORD</code>. On Vercel, filesystem saves may
            fail — use Export JSON and commit{" "}
            <code>src/data/customers/{plan.customerId}/plan.json</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className={labelClass}>Admin password</span>
            <input
              type="password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full"
          >
            {saving ? "Saving…" : "Save plan"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(exportJson);
              setStatus("JSON copied to clipboard.");
            }}
          >
            Copy JSON
          </Button>
        </CardContent>
        {status ? (
          <p className="px-6 pb-4 text-sm text-emerald-800">{status}</p>
        ) : null}
        {error ? (
          <p className="px-6 pb-4 text-sm text-rose-800">{error}</p>
        ) : null}
      </Card>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Overview callout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block">
            <span className={labelClass}>Display name</span>
            <input
              className={fieldClass}
              value={plan.displayName}
              onChange={(e) =>
                setPlan((p) => ({ ...p, displayName: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>Action callout</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={plan.callout}
              onChange={(e) =>
                setPlan((p) => ({ ...p, callout: e.target.value }))
              }
            />
          </label>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-lg">
              Performance experiments
            </CardTitle>
            <CardDescription>
              Message link, goal, what changed, benchmark vs current
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={addExperiment}
          >
            Add experiment
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {plan.experiments.map((exp) => (
            <div
              key={exp.id}
              className="space-y-3 rounded-2xl border border-[color:var(--panel-border)] bg-white/70 p-4"
            >
              <div className="flex justify-between gap-3">
                <p className="font-medium">{exp.name}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => removeExperiment(exp.id)}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Name</span>
                  <input
                    className={fieldClass}
                    value={exp.name}
                    onChange={(e) =>
                      updateExperiment(exp.id, { name: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Klaviyo URL</span>
                  <input
                    className={fieldClass}
                    value={exp.klaviyoUrl}
                    onChange={(e) =>
                      updateExperiment(exp.id, { klaviyoUrl: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Type</span>
                  <select
                    className={fieldClass}
                    value={exp.itemType}
                    onChange={(e) =>
                      updateExperiment(exp.id, {
                        itemType: e.target.value as Experiment["itemType"],
                      })
                    }
                  >
                    <option>Flow message</option>
                    <option>Campaign</option>
                    <option>Form</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Changed on</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={exp.changedOn}
                    onChange={(e) =>
                      updateExperiment(exp.id, { changedOn: e.target.value })
                    }
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Goal</span>
                  <input
                    className={fieldClass}
                    value={exp.goal}
                    onChange={(e) =>
                      updateExperiment(exp.id, { goal: e.target.value })
                    }
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Implemented</span>
                  <input
                    className={fieldClass}
                    value={exp.implemented}
                    onChange={(e) =>
                      updateExperiment(exp.id, { implemented: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Metric label</span>
                  <input
                    className={fieldClass}
                    value={exp.metricLabel}
                    onChange={(e) =>
                      updateExperiment(exp.id, { metricLabel: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Delta %</span>
                  <input
                    type="number"
                    step="0.1"
                    className={fieldClass}
                    value={exp.deltaPct}
                    onChange={(e) =>
                      updateExperiment(exp.id, {
                        deltaPct: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Benchmark value</span>
                  <input
                    className={fieldClass}
                    value={exp.benchmarkValue}
                    onChange={(e) =>
                      updateExperiment(exp.id, {
                        benchmarkValue: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Benchmark note</span>
                  <input
                    className={fieldClass}
                    value={exp.benchmarkNote}
                    onChange={(e) =>
                      updateExperiment(exp.id, {
                        benchmarkNote: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Current value</span>
                  <input
                    className={fieldClass}
                    value={exp.currentValue}
                    onChange={(e) =>
                      updateExperiment(exp.id, {
                        currentValue: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>Current note</span>
                  <input
                    className={fieldClass}
                    value={exp.currentNote}
                    onChange={(e) =>
                      updateExperiment(exp.id, { currentNote: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Goals</CardTitle>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={addGoal}
          >
            Add goal
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.goals.map((goal) => (
            <div
              key={goal.id}
              className="grid gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/70 p-3 sm:grid-cols-2"
            >
              <label className="sm:col-span-2">
                <span className={labelClass}>Statement</span>
                <input
                  className={fieldClass}
                  value={goal.statement}
                  onChange={(e) =>
                    updateGoal(goal.id, { statement: e.target.value })
                  }
                />
              </label>
              <label>
                <span className={labelClass}>Progress %</span>
                <input
                  type="number"
                  className={fieldClass}
                  value={goal.progressPct}
                  onChange={(e) =>
                    updateGoal(goal.id, {
                      progressPct: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span className={labelClass}>Detail</span>
                <input
                  className={fieldClass}
                  value={goal.detail}
                  onChange={(e) =>
                    updateGoal(goal.id, { detail: e.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Tasks</CardTitle>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={addTask}
          >
            Add task
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.tasks.map((task) => (
            <div
              key={task.id}
              className="grid gap-3 rounded-xl border border-[color:var(--panel-border)] bg-white/70 p-3 sm:grid-cols-3"
            >
              <label className="sm:col-span-3">
                <span className={labelClass}>Title</span>
                <input
                  className={fieldClass}
                  value={task.title}
                  onChange={(e) =>
                    updateTask(task.id, { title: e.target.value })
                  }
                />
              </label>
              <label>
                <span className={labelClass}>Owner</span>
                <input
                  className={fieldClass}
                  value={task.owner}
                  onChange={(e) =>
                    updateTask(task.id, { owner: e.target.value })
                  }
                />
              </label>
              <label>
                <span className={labelClass}>Status</span>
                <select
                  className={fieldClass}
                  value={task.status}
                  onChange={(e) =>
                    updateTask(task.id, {
                      status: e.target.value as Task["status"],
                    })
                  }
                >
                  <option>In progress</option>
                  <option>Blocked</option>
                  <option>Done</option>
                </select>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Meeting note</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Date</span>
            <input
              type="date"
              className={fieldClass}
              value={plan.meeting?.date ?? ""}
              onChange={(e) => updateMeeting({ date: e.target.value })}
            />
          </label>
          <label>
            <span className={labelClass}>Title</span>
            <input
              className={fieldClass}
              value={plan.meeting?.title ?? ""}
              onChange={(e) => updateMeeting({ title: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Summary</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={plan.meeting?.summary ?? ""}
              onChange={(e) => updateMeeting({ summary: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Next steps (one per line)</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={(plan.meeting?.nextSteps ?? []).join("\n")}
              onChange={(e) =>
                updateMeeting({
                  nextSteps: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">
              Product requests
            </CardTitle>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={addProductRequest}
            >
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.productRequests.map((item) => (
              <div key={item.id} className="grid gap-2">
                <input
                  className={fieldClass}
                  value={item.name}
                  onChange={(e) =>
                    updateProductRequest(item.id, { name: e.target.value })
                  }
                />
                <input
                  className={fieldClass}
                  value={item.status}
                  onChange={(e) =>
                    updateProductRequest(item.id, { status: e.target.value })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--panel-border)] bg-[color:var(--panel)]/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Zendesk</CardTitle>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={addTicket}
            >
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.tickets.map((item) => (
              <div key={item.id} className="grid gap-2">
                <input
                  className={fieldClass}
                  value={item.title}
                  onChange={(e) =>
                    updateTicket(item.id, { title: e.target.value })
                  }
                />
                <input
                  className={fieldClass}
                  value={item.meta}
                  onChange={(e) =>
                    updateTicket(item.id, { meta: e.target.value })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
