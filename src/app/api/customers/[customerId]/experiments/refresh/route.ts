import {
  getAdminPassword,
  getCustomerPlan,
  isAdminAuthorized,
  saveCustomerPlan,
} from "@/lib/plan/store";
import { pullAllExperimentMetrics } from "@/lib/plan/pull-experiment-metrics";
import { hasKlaviyoApiKey } from "@/lib/klaviyo/reporting";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ customerId: string }> };

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
        error: "Klaviyo API key not configured on this deployment",
        hint: "Add KLAVIYO_PRIVATE_API_KEY (and optional KLAVIYO_CONVERSION_METRIC_ID) in Vercel → Environment Variables, then redeploy. Or ask the Cursor agent with Klaviyo SSO to refresh experiment metrics for you.",
        hasApiKey: false,
      },
      { status: 501 },
    );
  }

  const { experiments, results } = await pullAllExperimentMetrics(
    plan.experiments,
  );
  const nextPlan = {
    ...plan,
    experiments,
    syncedAt: new Date().toISOString(),
  };
  const saved = await saveCustomerPlan(customerId, nextPlan);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, hint: saved.hint, results },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    storage: saved.storage,
    plan: nextPlan,
    results,
    passwordHint:
      process.env.NODE_ENV === "production"
        ? undefined
        : `Default local password: ${getAdminPassword()}`,
  });
}
