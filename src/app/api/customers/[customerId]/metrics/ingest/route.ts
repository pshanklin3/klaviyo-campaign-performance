import {
  applyMetricsIngest,
  metricsIngestExample,
  type MetricsIngestBody,
} from "@/lib/plan/metrics-ingest";
import {
  getAdminPassword,
  getCustomerPlan,
  getStorageMode,
  isAdminAuthorized,
  saveCustomerPlan,
} from "@/lib/plan/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ customerId: string }> };

/**
 * Auth: CSM admin password (x-csm-admin-password) OR
 * METRICS_INGEST_TOKEN via x-metrics-ingest-token / Authorization: Bearer.
 */
function isIngestAuthorized(request: Request): boolean {
  const admin = request.headers.get("x-csm-admin-password");
  if (isAdminAuthorized(admin)) return true;

  const token = process.env.METRICS_INGEST_TOKEN?.trim();
  if (!token) return false;

  const headerToken = request.headers.get("x-metrics-ingest-token")?.trim();
  if (headerToken && headerToken === token) return true;

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer === token) return true;
  }
  return false;
}

/** Schema + example for Claude / Cursor agents. */
export async function GET(_request: Request, { params }: Params) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  if (!plan) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    customerId,
    endpoint: `POST /api/customers/${customerId}/metrics/ingest`,
    auth: {
      headers: [
        "x-csm-admin-password: <CSM_ADMIN_PASSWORD>",
        "x-metrics-ingest-token: <METRICS_INGEST_TOKEN>",
        "Authorization: Bearer <METRICS_INGEST_TOKEN>",
      ],
      note: "Use CSM password or dedicated METRICS_INGEST_TOKEN. No Klaviyo private API key.",
    },
    workflow: [
      "1. Connect Klaviyo MCP (SSO) in Claude Desktop / Claude Code / Cursor",
      "2. Pull campaign + flow reports (Placed Order conversion metric)",
      "3. POST computed overview + experiment values to this endpoint",
      "4. App saves to Vercel Blob (or local plan.json) — no git push required",
    ],
    experimentIds: plan.experiments.map((e) => ({
      id: e.id,
      name: e.name,
      objectId: e.metricPull?.objectId ?? "",
      changedOn: e.changedOn,
    })),
    example: metricsIngestExample(customerId),
  });
}

/**
 * Ingest MCP-pulled metrics from Claude, Cursor, or any agent.
 * Does not call Klaviyo itself — the agent pulls via MCP, then posts numbers.
 */
export async function POST(request: Request, { params }: Params) {
  const { customerId } = await params;

  if (!isIngestAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Send x-csm-admin-password, or x-metrics-ingest-token / Bearer METRICS_INGEST_TOKEN.",
      },
      { status: 401 },
    );
  }

  const plan = await getCustomerPlan(customerId);
  if (!plan) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let body: MetricsIngestBody;
  try {
    body = (await request.json()) as MetricsIngestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.overview &&
    !body.periods?.length &&
    !body.experiments?.length &&
    typeof body.callout !== "string"
  ) {
    return NextResponse.json(
      {
        error: "Empty ingest body",
        hint: "Include overview, periods, experiments, and/or callout.",
        example: metricsIngestExample(customerId),
      },
      { status: 400 },
    );
  }

  const { plan: nextPlan, updated, missingExperimentIds } = applyMetricsIngest(
    plan,
    body,
  );

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
    storage: saved.storage,
    updated,
    missingExperimentIds,
    plan: fresh ?? nextPlan,
    passwordHint:
      process.env.NODE_ENV === "production"
        ? undefined
        : `Default local password: ${getAdminPassword()}`,
  });
}
