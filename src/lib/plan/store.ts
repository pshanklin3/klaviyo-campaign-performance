import { get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { CustomerPlan } from "./types";
import { emptyPlan } from "./types";

const customersDir = path.join(process.cwd(), "src/data/customers");

function planPath(customerId: string) {
  return path.join(customersDir, customerId, "plan.json");
}

function blobPathname(customerId: string) {
  return `customers/${customerId}/plan.json`;
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function readPlanFromBlob(
  customerId: string,
): Promise<CustomerPlan | null> {
  if (!hasBlobToken()) return null;

  try {
    const pathname = blobPathname(customerId);
    // Prefer direct get by pathname; fall back to list for older uploads.
    try {
      const result = await get(pathname, {
        access: "private",
        useCache: false,
      });
      if (result?.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as CustomerPlan;
      }
    } catch {
      // continue to list fallback
    }

    const listed = await list({ prefix: pathname, limit: 10 });
    const match =
      listed.blobs.find((b) => b.pathname === pathname) ?? listed.blobs[0];
    if (!match) return null;

    const response = await fetch(match.url);
    if (!response.ok) return null;
    return (await response.json()) as CustomerPlan;
  } catch {
    return null;
  }
}

async function writePlanToBlob(customerId: string, plan: CustomerPlan) {
  const pathname = blobPathname(customerId);
  await put(pathname, `${JSON.stringify(plan, null, 2)}\n`, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readPlanFromFile(
  customerId: string,
): Promise<CustomerPlan | null> {
  try {
    const raw = await fs.readFile(planPath(customerId), "utf8");
    return JSON.parse(raw) as CustomerPlan;
  } catch {
    return null;
  }
}

async function writePlanToFile(customerId: string, plan: CustomerPlan) {
  const dir = path.join(customersDir, customerId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    planPath(customerId),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );
}

export async function listCustomerIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(customersDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function getCustomerPlan(
  customerId: string,
): Promise<CustomerPlan | null> {
  const fromBlob = await readPlanFromBlob(customerId);
  if (fromBlob) return fromBlob;
  return readPlanFromFile(customerId);
}

export async function saveCustomerPlan(
  customerId: string,
  plan: CustomerPlan,
): Promise<
  | { ok: true; persisted: boolean; storage: "blob" | "file" }
  | { ok: false; error: string; hint?: string }
> {
  const normalized: CustomerPlan = {
    ...plan,
    customerId,
    syncedAt: new Date().toISOString(),
  };

  if (hasBlobToken()) {
    try {
      await writePlanToBlob(customerId, normalized);
      // Best-effort local mirror for git/dev convenience.
      try {
        await writePlanToFile(customerId, normalized);
      } catch {
        // ignore local mirror failures on serverless
      }
      return { ok: true, persisted: true, storage: "blob" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to write to Blob";
      return {
        ok: false,
        error: message,
        hint: "Check BLOB_READ_WRITE_TOKEN in Vercel env / Storage.",
      };
    }
  }

  try {
    await writePlanToFile(customerId, normalized);
    return { ok: true, persisted: true, storage: "file" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write plan file";
    return {
      ok: false,
      error: message,
      hint: "On Vercel, add a Blob store so Save works in production. Project → Storage → Create Blob Store (adds BLOB_READ_WRITE_TOKEN), then redeploy.",
    };
  }
}

export async function ensureCustomerPlan(
  customerId: string,
  displayName?: string,
): Promise<CustomerPlan> {
  const existing = await getCustomerPlan(customerId);
  if (existing) return existing;
  const created = emptyPlan(
    customerId,
    displayName ?? customerId.replace(/-/g, " "),
  );
  await saveCustomerPlan(customerId, created);
  return created;
}

export function getAdminPassword(): string {
  return process.env.CSM_ADMIN_PASSWORD?.trim() || "klaviyo-csm";
}

export function isAdminAuthorized(headerValue: string | null): boolean {
  if (!headerValue) return false;
  return headerValue === getAdminPassword();
}

export function getStorageMode(): "blob" | "file" {
  return hasBlobToken() ? "blob" : "file";
}
