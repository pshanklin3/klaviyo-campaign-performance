import { createHash, randomBytes } from "crypto";
import { get, list, put, del } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

const TOKEN_URL = "https://a.klaviyo.com/oauth/token";
const AUTHORIZE_URL = "https://www.klaviyo.com/oauth/authorize";

/** Scopes matching the Drake Dashboard OAuth app. */
export const KLAVIYO_OAUTH_SCOPES = [
  "accounts:read",
  "metrics:read",
  "campaigns:read",
  "flows:read",
  "forms:read",
  "segments:read",
  "usage:read",
].join(" ");

export type KlaviyoOAuthTokens = {
  customerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope?: string;
  tokenType?: string;
  connectedAt: string;
  updatedAt: string;
};

export type OAuthPendingState = {
  state: string;
  customerId: string;
  codeVerifier: string;
  createdAt: number;
};

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function oauthBlobPath(customerId: string) {
  return `customers/${customerId}/klaviyo-oauth.json`;
}

function oauthFilePath(customerId: string) {
  return path.join(
    process.cwd(),
    "src/data/customers",
    customerId,
    "klaviyo-oauth.json",
  );
}

function pendingBlobPath(state: string) {
  return `oauth-pending/${state}.json`;
}

export function hasKlaviyoOAuthApp(): boolean {
  return Boolean(
    process.env.KLAVIYO_CLIENT_ID?.trim() &&
      process.env.KLAVIYO_CLIENT_SECRET?.trim(),
  );
}

export function getOAuthRedirectUri(requestUrl: string): string {
  const configured = process.env.KLAVIYO_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const url = new URL(requestUrl);
  return `${url.origin}/api/klaviyo/oauth/callback`;
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

async function readJsonBlob<T>(pathname: string): Promise<T | null> {
  if (!hasBlobToken()) return null;
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as T;
    }
  } catch {
    // fall through
  }
  try {
    const listed = await list({ prefix: pathname, limit: 5 });
    const match =
      listed.blobs.find((b) => b.pathname === pathname) ?? listed.blobs[0];
    if (!match) return null;
    const response = await fetch(match.url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function writeJsonBlob(pathname: string, data: unknown) {
  if (!hasBlobToken()) {
    throw new Error("BLOB_READ_WRITE_TOKEN required to store Klaviyo OAuth tokens");
  }
  await put(pathname, `${JSON.stringify(data, null, 2)}\n`, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function deleteBlob(pathname: string) {
  if (!hasBlobToken()) return;
  try {
    await del(pathname);
  } catch {
    // ignore
  }
}

export async function savePendingOAuthState(pending: OAuthPendingState) {
  if (hasBlobToken()) {
    await writeJsonBlob(pendingBlobPath(pending.state), pending);
    return;
  }
  const dir = path.join(process.cwd(), ".data", "oauth-pending");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${pending.state}.json`),
    `${JSON.stringify(pending)}\n`,
    "utf8",
  );
}

export async function takePendingOAuthState(
  state: string,
): Promise<OAuthPendingState | null> {
  if (hasBlobToken()) {
    const pending = await readJsonBlob<OAuthPendingState>(
      pendingBlobPath(state),
    );
    if (pending) await deleteBlob(pendingBlobPath(state));
    return pending;
  }
  const file = path.join(
    process.cwd(),
    ".data",
    "oauth-pending",
    `${state}.json`,
  );
  try {
    const raw = await fs.readFile(file, "utf8");
    await fs.unlink(file).catch(() => undefined);
    return JSON.parse(raw) as OAuthPendingState;
  } catch {
    return null;
  }
}

export async function saveOAuthTokens(tokens: KlaviyoOAuthTokens) {
  if (hasBlobToken()) {
    await writeJsonBlob(oauthBlobPath(tokens.customerId), tokens);
    return;
  }
  const file = oauthFilePath(tokens.customerId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
}

export async function loadOAuthTokens(
  customerId: string,
): Promise<KlaviyoOAuthTokens | null> {
  if (hasBlobToken()) {
    return readJsonBlob<KlaviyoOAuthTokens>(oauthBlobPath(customerId));
  }
  try {
    const raw = await fs.readFile(oauthFilePath(customerId), "utf8");
    return JSON.parse(raw) as KlaviyoOAuthTokens;
  } catch {
    return null;
  }
}

export async function deleteOAuthTokens(customerId: string) {
  if (hasBlobToken()) {
    await deleteBlob(oauthBlobPath(customerId));
    return;
  }
  await fs.unlink(oauthFilePath(customerId)).catch(() => undefined);
}

export function buildAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scopes ?? KLAVIYO_OAUTH_SCOPES,
    state: options.state,
    code_challenge_method: "S256",
    code_challenge: options.codeChallenge,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  const raw = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${raw}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const clientId = process.env.KLAVIYO_CLIENT_ID?.trim();
  const clientSecret = process.env.KLAVIYO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("KLAVIYO_CLIENT_ID / KLAVIYO_CLIENT_SECRET not configured");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Klaviyo token exchange failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

export async function exchangeAuthorizationCode(options: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  customerId: string;
}): Promise<KlaviyoOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    code_verifier: options.codeVerifier,
    redirect_uri: options.redirectUri,
  });
  const token = await postToken(body);
  const now = Date.now();
  return {
    customerId: options.customerId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: now + token.expires_in * 1000,
    scope: token.scope,
    tokenType: token.token_type,
    connectedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

export async function refreshAccessToken(
  tokens: KlaviyoOAuthTokens,
): Promise<KlaviyoOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  const token = await postToken(body);
  const now = Date.now();
  const next: KlaviyoOAuthTokens = {
    ...tokens,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || tokens.refreshToken,
    expiresAt: now + token.expires_in * 1000,
    scope: token.scope ?? tokens.scope,
    tokenType: token.token_type ?? tokens.tokenType,
    updatedAt: new Date(now).toISOString(),
  };
  await saveOAuthTokens(next);
  return next;
}

/** Return a valid access token, refreshing if needed. */
export async function getValidAccessToken(
  customerId: string,
): Promise<string | null> {
  const tokens = await loadOAuthTokens(customerId);
  if (!tokens) return null;
  const skewMs = 60_000;
  if (tokens.expiresAt > Date.now() + skewMs) {
    return tokens.accessToken;
  }
  try {
    const refreshed = await refreshAccessToken(tokens);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export async function getOAuthConnectionStatus(customerId: string): Promise<{
  connected: boolean;
  connectedAt?: string;
  updatedAt?: string;
  scope?: string;
  appConfigured: boolean;
}> {
  const tokens = await loadOAuthTokens(customerId);
  return {
    appConfigured: hasKlaviyoOAuthApp(),
    connected: Boolean(tokens?.accessToken && tokens?.refreshToken),
    connectedAt: tokens?.connectedAt,
    updatedAt: tokens?.updatedAt,
    scope: tokens?.scope,
  };
}
