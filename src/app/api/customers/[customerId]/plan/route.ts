import {
  getAdminPassword,
  getCustomerPlan,
  getStorageMode,
  isAdminAuthorized,
  saveCustomerPlan,
} from "@/lib/plan/store";
import type { CustomerPlan } from "@/lib/plan/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  if (!plan) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json(plan);
}

export async function PUT(request: Request, { params }: Params) {
  const { customerId } = await params;
  const password = request.headers.get("x-csm-admin-password");
  if (!isAdminAuthorized(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CustomerPlan;
  try {
    body = (await request.json()) as CustomerPlan;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await saveCustomerPlan(customerId, {
    ...body,
    customerId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        hint: result.hint,
        storage: getStorageMode(),
        passwordHint:
          process.env.NODE_ENV === "production"
            ? undefined
            : `Default local password: ${getAdminPassword()}`,
      },
      { status: 500 },
    );
  }

  const plan = await getCustomerPlan(customerId);
  return NextResponse.json({
    ok: true,
    persisted: result.persisted,
    storage: result.storage,
    plan: plan ?? body,
  });
}
