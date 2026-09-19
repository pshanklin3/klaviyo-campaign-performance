import {
  findConversionMetricId,
  hasKlaviyoConnection,
  resolveKlaviyoAuth,
  withKlaviyoAuth,
} from "@/lib/klaviyo/reporting";
import { pullAllExperimentMetrics } from "@/lib/plan/pull-experiment-metrics";
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
 * One-click refresh via Klaviyo OAuth (preferred) or optional API key.
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

  try {
    const auth = await resolveKlaviyoAuth(customerId);
    // Sequential pulls keep OAuth auth context reliable and surface clearer errors.
    // Overview first (ecom + L30 attributed); experiments second so a slow
    // report rate-limit still saves overview progress.
    const result = await withKlaviyoAuth(auth, async () => {
      // Lightweight auth probe before the heavy report fan-out
      await findConversionMetricId();
      const overviewPull = await pullOverviewMetrics(plan);
      const experimentPull = await pullAllExperimentMetrics(plan.experiments);
      return { overviewPull, experimentPull };
    });
    const { overviewPull, experimentPull } = result;

    const syncedAt = new Date().toISOString();
    const nextPlan = {
      ...plan,
      syncedAt,
      callout: overviewPull.callout,
      overview: overviewPull.overview,
      periods: overviewPull.periods,
      experiments: experimentPull.experiments,
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
      results: experimentPull.results,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Refresh failed";
    const rateLimited = /\b429\b|rate.?limit/i.test(message);
    const authFailed = /\b401\b|\b403\b|not connected|refresh token/i.test(
      message,
    );
    return NextResponse.json(
      {
        error: message,
        hint: authFailed
          ? "Token may be invalid — click Reconnect Klaviyo, approve again, then Refresh."
          : rateLimited
            ? "Klaviyo reporting is rate-limited. Wait ~30s and click Refresh metrics once."
            : "If this keeps failing, Reconnect Klaviyo and try Refresh again.",
        mode: authFailed ? "oauth_required" : undefined,
      },
      { status: authFailed ? 401 : 500 },
    );
  }
}
