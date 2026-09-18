import { promises as fs } from "fs";
import path from "path";
import type { CustomerPlan } from "./types";
import { emptyPlan } from "./types";

const customersDir = path.join(process.cwd(), "src/data/customers");

function planPath(customerId: string) {
  return path.join(customersDir, customerId, "plan.json");
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
  try {
    const raw = await fs.readFile(planPath(customerId), "utf8");
    return JSON.parse(raw) as CustomerPlan;
  } catch {
    return null;
  }
}

export async function saveCustomerPlan(
  customerId: string,
  plan: CustomerPlan,
): Promise<{ ok: true; persisted: boolean } | { ok: false; error: string }> {
  const normalized: CustomerPlan = {
    ...plan,
    customerId,
    syncedAt: plan.syncedAt || new Date().toISOString(),
  };

  try {
    const dir = path.join(customersDir, customerId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      planPath(customerId),
      `${JSON.stringify(normalized, null, 2)}\n`,
      "utf8",
    );
    return { ok: true, persisted: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write plan file";
    // Serverless filesystems are often read-only; surface a clear signal.
    return { ok: false, error: message };
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
