import {
  clearConversionMetricCache,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { ensureExperimentMetricPull } from "@/lib/plan/experiment-metrics";
import {
  pullExperimentMetrics,
  type ExperimentPullPhase,
} from "@/lib/plan/pull-experiment-metrics";
import {
  getAdminPassword,
  getCustomerPlan,
  getStorageMode,
  isAdminAuthorized,
  saveCustomerPlan,
} from "@/lib/plan/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ customerId: string }> };

/**
 * One experiment window per request (benchmark OR current).
 * Client must wait ~60s between calls — values-reports are ~2/min.
 */
export async function POST(request: Request, { params }: Params) {
  const { customerId } = await params;
  const password = request.headers.get("x-csm-admin-password");
  if (!isAdminAuthorized(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    experimentId?: string;
    phase?: ExperimentPullPhase;
  } | null;
  const experimentId = body?.experimentId?.trim();
  const phase: ExperimentPullPhase =
    body?.phase === "benchmark" ? "benchmark" : "current";
  if (!experimentId) {
    return NextResponse.json(
      { error: "experimentId is required" },
      { status: 400 },
    );
  }

  const plan = await getCustomerPlan(customerId);
  if (!plan) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (!(await hasKlaviyoConnection(customerId))) {
    return NextResponse.json(
      {
        ok: false,
        error: "Klaviyo not connected",
        hint: "Click Connect Klaviyo on this page (OAuth).",
        mode: "oauth_required",
      },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  const experiment = plan.experiments.find((e) => e.id === experimentId);
  if (!experiment) {
    return NextResponse.json(
      { error: `Experiment not found: ${experimentId}` },
      { status: 404 },
    );
  }

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);
    const normalized = ensureExperimentMetricPull(experiment);

    if (!normalized.metricPull.autoPull) {
      return NextResponse.json({
        ok: true,
        pass: "experiment",
        experimentId,
        phase,
        skipped: true,
        detail: "Skipped (manual values)",
        plan,
        nextWaitSec: 0,
      });
    }

    const pulled = await withKlaviyoAuth(auth, () =>
      pullExperimentMetrics(normalized, phase),
    );

    if (!pulled.ok) {
      const waitMatch = pulled.error.match(/wait\s+(\d+)\s*s/i);
      const expectedMatch = pulled.error.match(
        /Expected available in\s+(\d+)\s+seconds?/i,
      );
      const retryAfterSec = waitMatch
        ? Number(waitMatch[1])
        : expectedMatch
          ? Number(expectedMatch[1])
          : /429|throttled|rate.?limit/i.test(pulled.error)
            ? 60
            : 0;
      return NextResponse.json(
        {
          ok: false,
          pass: "experiment",
          experimentId,
          phase,
          name: normalized.name,
          error: pulled.error,
          retryAfterSec,
          elapsedMs: Date.now() - startedAt,
        },
        { status: /429|throttled/i.test(pulled.error) ? 429 : 500 },
      );
    }

    const experiments = plan.experiments.map((e) =>
      e.id === normalized.id ? { ...normalized, ...pulled.values } : e,
    );
    const nextPlan = {
      ...plan,
      syncedAt: new Date().toISOString(),
      experiments,
    };
    const saved = await saveCustomerPlan(customerId, nextPlan);
    if (!saved.ok) {
      return NextResponse.json(
        {
          error: saved.error,
          hint: saved.hint,
          storage: getStorageMode(),
        },
        { status: 500 },
      );
    }

    const fresh = await getCustomerPlan(customerId);
    return NextResponse.json({
      ok: true,
      mode: auth.type === "oauth" ? "oauth" : "api_key",
      pass: "experiment",
      experimentId,
      phase,
      name: normalized.name,
      detail: pulled.detail ?? "Updated",
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      nextWaitSec: 60,
      elapsedMs: Date.now() - startedAt,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Experiment refresh failed";
    const waitMatch = message.match(/wait\s+(\d+)\s*s/i);
    const expectedMatch = message.match(
      /Expected available in\s+(\d+)\s+seconds?/i,
    );
    const retryAfterSec = waitMatch
      ? Number(waitMatch[1])
      : expectedMatch
        ? Number(expectedMatch[1])
        : /429|throttled|rate.?limit/i.test(message)
          ? 60
          : 0;
    return NextResponse.json(
      {
        error: message,
        pass: "experiment",
        experimentId,
        phase,
        retryAfterSec,
        hint:
          retryAfterSec > 0
            ? `Wait ${retryAfterSec}s for Klaviyo rate limits, then retry.`
            : "Try Refresh again.",
        elapsedMs: Date.now() - startedAt,
      },
      { status: retryAfterSec > 0 ? 429 : 500 },
    );
  }
}
