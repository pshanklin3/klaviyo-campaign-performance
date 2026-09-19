import {
  clearConversionMetricCache,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { pullAttributedMetrics } from "@/lib/plan/pull-attributed-metrics";
import { pullExperimentMetrics } from "@/lib/plan/pull-experiment-metrics";
import { ensureExperimentMetricPull } from "@/lib/plan/experiment-metrics";
import type { Experiment } from "@/lib/plan/types";
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
 * Second pass after ecom refresh: attributed L30, then experiments
 * one-by-one until the time budget is nearly spent.
 */
export async function POST(request: Request, { params }: Params) {
  const { customerId } = await params;
  const password = request.headers.get("x-csm-admin-password");
  if (!isAdminAuthorized(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const hardStopMs = startedAt + 50_000;

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);

    const attributed = await withKlaviyoAuth(auth, () =>
      pullAttributedMetrics(plan),
    );

    let experiments: Experiment[] = plan.experiments.map(
      ensureExperimentMetricPull,
    );
    const results: {
      id: string;
      name: string;
      ok: boolean;
      detail: string;
    }[] = [];

    // Pull experiments sequentially while time remains (each uses slow reports).
    for (let i = 0; i < experiments.length; i++) {
      const experiment = experiments[i];
      if (Date.now() > hardStopMs - 10_000) {
        results.push({
          id: experiment.id,
          name: experiment.name,
          ok: true,
          detail: "Skipped this pass (time budget) — click Refresh again",
        });
        continue;
      }

      const normalized = ensureExperimentMetricPull(experiment);
      if (!normalized.metricPull.autoPull) {
        experiments[i] = normalized;
        results.push({
          id: normalized.id,
          name: normalized.name,
          ok: true,
          detail: "Skipped (manual values)",
        });
        continue;
      }

      const pulled = await withKlaviyoAuth(auth, () =>
        pullExperimentMetrics(normalized),
      );
      if (!pulled.ok) {
        experiments[i] = normalized;
        results.push({
          id: normalized.id,
          name: normalized.name,
          ok: false,
          detail: pulled.error,
        });
        continue;
      }

      experiments[i] = { ...normalized, ...pulled.values };
      results.push({
        id: normalized.id,
        name: normalized.name,
        ok: true,
        detail: pulled.detail ?? "Updated",
      });
    }

    const syncedAt = new Date().toISOString();
    const nextPlan = {
      ...plan,
      syncedAt,
      callout: attributed.callout,
      overview: attributed.overview,
      periods: attributed.periods,
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
    const skipped = results.filter((r) => /Skipped this pass/i.test(r.detail));
    return NextResponse.json({
      ok: true,
      mode: auth.type === "oauth" ? "oauth" : "api_key",
      pass: "attributed",
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      results,
      partial: skipped.length > 0,
      elapsedMs: Date.now() - startedAt,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attributed refresh failed";
    const rateLimited = /\b429\b|rate.?limit/i.test(message);
    const authFailed = /\b401\b|\b403\b|not connected|refresh token/i.test(
      message,
    );
    return NextResponse.json(
      {
        error: message,
        hint: authFailed
          ? "Token may be invalid — click Reconnect Klaviyo, then Refresh."
          : rateLimited
            ? "Klaviyo reporting rate-limited. Wait ~30s and Refresh again for pass 2."
            : "Ecom was saved; attributed pass failed — try Refresh again.",
        mode: authFailed ? "oauth_required" : undefined,
        pass: "attributed",
        elapsedMs: Date.now() - startedAt,
      },
      { status: authFailed ? 401 : 500 },
    );
  }
}
