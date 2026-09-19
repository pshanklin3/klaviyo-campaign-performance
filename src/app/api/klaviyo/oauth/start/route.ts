import {
  buildAuthorizeUrl,
  createOAuthState,
  createPkcePair,
  exchangeAuthorizationCode,
  getOAuthRedirectUri,
  hasKlaviyoOAuthApp,
  saveOAuthTokens,
  savePendingOAuthState,
  takePendingOAuthState,
} from "@/lib/klaviyo/oauth";
import { isAdminAuthorized } from "@/lib/plan/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Start OAuth: POST { customerId } with CSM password.
 * Returns { authorizeUrl } for the browser to navigate to.
 */
export async function POST(request: Request) {
  if (!hasKlaviyoOAuthApp()) {
    return NextResponse.json(
      {
        error: "OAuth app not configured",
        hint: "Add KLAVIYO_CLIENT_ID and KLAVIYO_CLIENT_SECRET (Secret) on Vercel, then Redeploy.",
      },
      { status: 400 },
    );
  }

  const password = request.headers.get("x-csm-admin-password");
  if (!isAdminAuthorized(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { customerId?: string };
  try {
    body = (await request.json()) as { customerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerId = body.customerId?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const clientId = process.env.KLAVIYO_CLIENT_ID!.trim();
  const redirectUri = getOAuthRedirectUri(request.url);
  const state = createOAuthState();
  const { codeVerifier, codeChallenge } = createPkcePair();

  await savePendingOAuthState({
    state,
    customerId,
    codeVerifier,
    createdAt: Date.now(),
  });

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  return NextResponse.json({
    ok: true,
    authorizeUrl,
    redirectUri,
  });
}
