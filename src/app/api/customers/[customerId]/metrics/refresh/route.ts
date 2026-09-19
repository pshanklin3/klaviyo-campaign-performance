import {
  clearConversionMetricCache,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { pullOverviewMetrics } from "@/lib/plan/pull-overview-metrics";
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
 * Fast refresh: ecom (metric-aggregates) only.
 * Attributed campaign/flow reports + experiments are too slow for one
 * serverless invocation under Klaviyo rate limits.
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
        hint: "Click Connect Klaviyo on this page (OAuth). Do not use a customer private API key.",
        mode: "oauth_required",
      },
      { status: 400 },
    );
  }

  const startedAt = Date.now();

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);

    const overviewPull = await withKlaviyoAuth(auth, () =>
      pullOverviewMetrics(plan),
    );

    const syncedAt = new Date().toISOString();
    const nextPlan = {
      ...plan,
      syncedAt,
      callout: overviewPull.callout,
      overview: overviewPull.overview,
      periods: overviewPull.periods,
      // Experiments unchanged on this fast path
      experiments: plan.experiments,
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
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      results: plan.experiments.map((e) => ({
        id: e.id,
        name: e.name,
        ok: true,
        detail: "Unchanged (ecom-only refresh)",
      })),
      elapsedMs: Date.now() - startedAt,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Refresh failed";
    const waitMatch = message.match(/wait\s+(\d+)\s*s/i);
    const waitSec = waitMatch ? Number(waitMatch[1]) : 0;
    const rateLimited = /\b429\b|rate.?limit|throttled/i.test(message);
    const authFailed = /\b401\b|\b403\b|not connected|refresh token/i.test(
      message,
    );
    return NextResponse.json(
      {
        error: message,
        retryAfterSec: waitSec || (rateLimited ? 5 : 0),
        hint: authFailed
          ? "Token may be invalid — click Reconnect Klaviyo, approve again, then Refresh."
          : rateLimited
            ? waitSec > 0 && waitSec <= 15
              ? `Brief rate limit — wait ${waitSec}s and Refresh will retry automatically.`
              : `Klaviyo rate-limited. Wait ${waitSec || 45}s, then click Refresh once.`
            : "If this keeps failing, Reconnect Klaviyo and try Refresh again.",
        mode: authFailed ? "oauth_required" : undefined,
        elapsedMs: Date.now() - startedAt,
      },
      { status: authFailed ? 401 : rateLimited ? 429 : 500 },
    );
  }
}
