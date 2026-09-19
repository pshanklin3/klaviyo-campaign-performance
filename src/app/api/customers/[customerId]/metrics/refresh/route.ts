import { hasKlaviyoApiKey } from "@/lib/klaviyo/reporting";
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
 * One-click / prompt refresh: pull overview + experiments from Klaviyo
 * Reporting API and save to Blob. Requires KLAVIYO_PRIVATE_API_KEY.
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

  if (!hasKlaviyoApiKey()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Klaviyo not connected on the server",
        hint: "In Vercel → Settings → Environment Variables, add KLAVIYO_PRIVATE_API_KEY as a Secret (read-only key from Klaviyo → Settings → API keys), then Redeploy. After that, Refresh metrics works with one click.",
      },
      { status: 400 },
    );
  }

  try {
    const [overviewPull, experimentPull] = await Promise.all([
      pullOverviewMetrics(plan),
      pullAllExperimentMetrics(plan.experiments),
    ]);

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
      mode: "api_key",
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      results: experimentPull.results,
      passwordHint:
        process.env.NODE_ENV === "production"
          ? undefined
          : `Default local password: ${getAdminPassword()}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Refresh failed",
        hint: "Check KLAVIYO_PRIVATE_API_KEY scopes (read metrics / reporting) and redeploy.",
      },
      { status: 500 },
    );
  }
}
