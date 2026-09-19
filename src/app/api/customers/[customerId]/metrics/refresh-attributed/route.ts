import {
  clearConversionMetricCache,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { pullAttributedMetrics } from "@/lib/plan/pull-attributed-metrics";
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

/** Pass 2: attributed L30 only (campaign + flow values-reports). */
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

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);
    const attributed = await withKlaviyoAuth(auth, () =>
      pullAttributedMetrics(plan),
    );

    const syncedAt = new Date().toISOString();
    const nextPlan = {
      ...plan,
      syncedAt,
      callout: attributed.callout,
      overview: attributed.overview,
      periods: attributed.periods,
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
      pass: "attributed",
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      // Used 2 values-report calls — client should wait before experiments
      nextWaitSec: 45,
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
            ? "Klaviyo reporting rate-limited. Wait ~30s and Refresh again."
            : "Ecom was saved; attributed pass failed — try Refresh again.",
        mode: authFailed ? "oauth_required" : undefined,
        pass: "attributed",
        elapsedMs: Date.now() - startedAt,
      },
      { status: authFailed ? 401 : 500 },
    );
  }
}
