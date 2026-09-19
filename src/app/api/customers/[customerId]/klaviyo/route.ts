import {
  deleteOAuthTokens,
  getOAuthConnectionStatus,
} from "@/lib/klaviyo/oauth";
import { isAdminAuthorized } from "@/lib/plan/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { customerId } = await params;
  const status = await getOAuthConnectionStatus(customerId);
  return NextResponse.json({ ok: true, ...status });
}

export async function DELETE(request: Request, { params }: Params) {
  const { customerId } = await params;
  const password = request.headers.get("x-csm-admin-password");
  if (!isAdminAuthorized(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteOAuthTokens(customerId);
  return NextResponse.json({ ok: true, connected: false });
}
