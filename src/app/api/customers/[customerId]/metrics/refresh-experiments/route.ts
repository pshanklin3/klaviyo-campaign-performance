import {
  clearConversionMetricCache,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { ensureExperimentMetricPull } from "@/lib/plan/experiment-metrics";
import { pullExperimentMetrics } from "@/lib/plan/pull-experiment-metrics";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pass 3: experiments only — full time budget, sequential, rate-limit aware. */
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
  const hardStopMs = startedAt + 52_000;

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);

    const experiments: Experiment[] = plan.experiments.map(
      ensureExperimentMetricPull,
    );
    const results: {
      id: string;
      name: string;
      ok: boolean;
      detail: string;
    }[] = [];

    for (let i = 0; i < experiments.length; i++) {
      const experiment = experiments[i];
      if (Date.now() > hardStopMs - 8_000) {
        results.push({
          id: experiment.id,
          name: experiment.name,
          ok: true,
          detail: "Deferred — click Refresh again to finish remaining experiments",
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

      // Brief pause between experiments so values-report steady limits recover
      if (i > 0) await sleep(1500);

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
        // Extra cooldown after a failure (often 429)
        if (/429|rate.?limit/i.test(pulled.error)) {
          await sleep(8_000);
        }
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
      experiments,
    };

    const saved = await saveCustomerPlan(customerId, nextPlan);
    if (!saved.ok) {
      return NextResponse.json(
        {
          error: saved.error,
          hint: saved.hint,
          storage: getStorageMode(),
          results,
        },
        { status: 500 },
      );
    }

    const fresh = await getCustomerPlan(customerId);
    const deferred = results.filter((r) => /Deferred/i.test(r.detail));
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      ok: true,
      mode: auth.type === "oauth" ? "oauth" : "api_key",
      pass: "experiments",
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      results,
      partial: deferred.length > 0 || failed.length > 0,
      elapsedMs: Date.now() - startedAt,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Experiment refresh failed";
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
            ? "Klaviyo reporting rate-limited. Wait ~30s and Refresh again for experiments."
            : "Ecom/attributed were saved; experiments pass failed — try Refresh again.",
        mode: authFailed ? "oauth_required" : undefined,
        pass: "experiments",
        elapsedMs: Date.now() - startedAt,
      },
      { status: authFailed ? 401 : 500 },
    );
  }
}
