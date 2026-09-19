import {
  exchangeAuthorizationCode,
  getOAuthRedirectUri,
  saveOAuthTokens,
  takePendingOAuthState,
} from "@/lib/klaviyo/oauth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * OAuth callback — exchange code for tokens and redirect to the account page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const dest = new URL("/c/hunter-trading", url.origin);
    dest.searchParams.set(
      "oauth",
      `error:${errorDescription || error}`,
    );
    return NextResponse.redirect(dest);
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  const pending = await takePendingOAuthState(state);
  if (!pending) {
    return NextResponse.json(
      { error: "Unknown or expired OAuth state — try Connect again" },
      { status: 400 },
    );
  }

  // Reject stale pending states (> 30 min)
  if (Date.now() - pending.createdAt > 30 * 60 * 1000) {
    return NextResponse.json(
      { error: "OAuth state expired — try Connect again" },
      { status: 400 },
    );
  }

  try {
    const redirectUri = getOAuthRedirectUri(request.url);
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri,
      customerId: pending.customerId,
    });
    await saveOAuthTokens(tokens);

    const dest = new URL(`/c/${pending.customerId}`, url.origin);
    dest.searchParams.set("oauth", "connected");
    return NextResponse.redirect(dest);
  } catch (err) {
    const dest = new URL(`/c/${pending.customerId}`, url.origin);
    dest.searchParams.set(
      "oauth",
      `error:${err instanceof Error ? err.message : "token exchange failed"}`,
    );
    return NextResponse.redirect(dest);
  }
}
