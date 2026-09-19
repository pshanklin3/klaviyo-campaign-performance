import {
  clearConversionMetricCache,
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
/** Pro plans honor up to 300s; Hobby still caps lower — finish overview first. */
export const maxDuration = 60;

type Params = { params: Promise<{ customerId: string }> };

/**
 * One-click refresh via Klaviyo OAuth (preferred) or optional API key.
 * Overview is required; experiments are best-effort within a time budget.
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
  // Leave headroom before the platform kills the function (~60s).
  const experimentDeadlineMs = startedAt + 45_000;

  try {
    clearConversionMetricCache();
    const auth = await resolveKlaviyoAuth(customerId);

    const overviewPull = await withKlaviyoAuth(auth, async () => {
      await findConversionMetricId();
      return pullOverviewMetrics(plan);
    });

    let experiments = plan.experiments;
    let experimentResults: {
      id: string;
      name: string;
      ok: boolean;
      detail: string;
    }[] = [];

    const remainingMs = experimentDeadlineMs - Date.now();
    if (remainingMs > 12_000) {
      try {
        const experimentPull = await withKlaviyoAuth(auth, () =>
          pullAllExperimentMetrics(plan.experiments),
        );
        experiments = experimentPull.experiments;
        experimentResults = experimentPull.results;
      } catch (experimentError) {
        experimentResults = plan.experiments.map((e) => ({
          id: e.id,
          name: e.name,
          ok: false,
          detail:
            experimentError instanceof Error
              ? experimentError.message
              : "Experiment pull failed",
        }));
      }
    } else {
      experimentResults = plan.experiments.map((e) => ({
        id: e.id,
        name: e.name,
        ok: true,
        detail: "Skipped this pass (overview saved; refresh again for experiments)",
      }));
    }

    const syncedAt = new Date().toISOString();
    const nextPlan = {
      ...plan,
      syncedAt,
      callout: overviewPull.callout,
      overview: overviewPull.overview,
      periods: overviewPull.periods,
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
      storage: saved.storage,
      plan: fresh ?? nextPlan,
      results: experimentResults,
      elapsedMs: Date.now() - startedAt,
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
        elapsedMs: Date.now() - startedAt,
      },
      { status: authFailed ? 401 : 500 },
    );
  }
}
