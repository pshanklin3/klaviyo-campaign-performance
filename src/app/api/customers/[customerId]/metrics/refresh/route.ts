import {
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
    const { overviewPull, experimentPull } = await withKlaviyoAuth(
      auth,
      async () => {
        const [overview, experiments] = await Promise.all([
          pullOverviewMetrics(plan),
          pullAllExperimentMetrics(plan.experiments),
        ]);
        return { overviewPull: overview, experimentPull: experiments };
      },
    );

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Refresh failed",
        hint: "Try Connect Klaviyo again, then Refresh metrics.",
      },
      { status: 500 },
    );
  }
}
