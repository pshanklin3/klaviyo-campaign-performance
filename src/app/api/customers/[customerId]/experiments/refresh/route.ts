import { hasKlaviyoApiKey } from "@/lib/klaviyo/reporting";
import { pullAllExperimentMetrics } from "@/lib/plan/pull-experiment-metrics";
import {
  getAdminPassword,
  getCustomerPlan,
  isAdminAuthorized,
  saveCustomerPlan,
} from "@/lib/plan/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ customerId: string }> };

/**
 * Metric refresh is MCP-first (Cursor + Klaviyo SSO).
 * Private API key is only an optional server-side fallback — not required.
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

  // Optional fallback only — primary path is Cursor agent + Klaviyo MCP.
  if (hasKlaviyoApiKey()) {
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
      mode: "api_key",
      storage: saved.storage,
      plan: nextPlan,
      results,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "mcp",
    plan,
    message:
      "Experiment metrics refresh through Cursor + Klaviyo MCP (SSO), not a private API key.",
    hint: `Pull via Klaviyo MCP (Claude or Cursor), then POST numbers to /api/customers/${customerId}/metrics/ingest (CSM password or METRICS_INGEST_TOKEN). Or commit plan.json and redeploy.`,
    passwordHint:
      process.env.NODE_ENV === "production"
        ? undefined
        : `Default local password: ${getAdminPassword()}`,
  });
}
