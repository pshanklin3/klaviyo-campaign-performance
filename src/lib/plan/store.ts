import { get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { ensureExperimentMetricPull } from "./experiment-metrics";
import type { CustomerPlan, Experiment } from "./types";
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

function pulledAtMs(experiment: Experiment): number {
  return experiment.lastPulledAt
    ? Date.parse(experiment.lastPulledAt) || 0
    : 0;
}

function syncedAtMs(plan: CustomerPlan): number {
  return plan.syncedAt ? Date.parse(plan.syncedAt) || 0 : 0;
}

/**
 * Blob holds CSM edits; git/file holds MCP-refreshed metric values.
 * Prefer newer lastPulledAt for experiment benchmark/current fields, and
 * newer syncedAt for Account Overview / periods / callout so Cursor SSO
 * refreshes show up on Vercel without a private API key.
 */
export function mergeCustomerPlans(
  edited: CustomerPlan,
  fromRepo: CustomerPlan,
): CustomerPlan {
  const repoById = new Map(
    fromRepo.experiments.map((e) => [e.id, ensureExperimentMetricPull(e)]),
  );
  const mergedExperiments = edited.experiments.map((raw) => {
    const editedExp = ensureExperimentMetricPull(raw);
    const repoExp = repoById.get(editedExp.id);
    if (!repoExp) return editedExp;
    if (pulledAtMs(repoExp) > pulledAtMs(editedExp)) {
      return {
        ...editedExp,
        metricPull: repoExp.metricPull,
        metricLabel: repoExp.metricLabel,
        benchmarkValue: repoExp.benchmarkValue,
        benchmarkNote: repoExp.benchmarkNote,
        currentValue: repoExp.currentValue,
        currentNote: repoExp.currentNote,
        deltaPct: repoExp.deltaPct,
        lastPulledAt: repoExp.lastPulledAt,
      };
    }
    return editedExp;
  });

  for (const [id, repoExp] of repoById) {
    if (!mergedExperiments.some((e) => e.id === id)) {
      mergedExperiments.push(repoExp);
    }
  }

  const preferRepoOverview = syncedAtMs(fromRepo) > syncedAtMs(edited);

  return {
    ...edited,
    ...(preferRepoOverview
      ? {
          syncedAt: fromRepo.syncedAt,
          callout: fromRepo.callout || edited.callout,
          overview: fromRepo.overview,
          periods: fromRepo.periods.length ? fromRepo.periods : edited.periods,
        }
      : {}),
    experiments: mergedExperiments,
  };
}

async function readPlanFromBlob(
  customerId: string,
): Promise<CustomerPlan | null> {
  if (!hasBlobToken()) return null;

  try {
    const pathname = blobPathname(customerId);
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
  const fromFile = await readPlanFromFile(customerId);
  if (!fromBlob && !fromFile) return null;

  const plan =
    fromBlob && fromFile
      ? mergeCustomerPlans(fromBlob, fromFile)
      : (fromBlob ?? fromFile)!;

  return {
    ...plan,
    experiments: plan.experiments.map(ensureExperimentMetricPull),
  };
}

export async function saveCustomerPlan(
  customerId: string,
  plan: CustomerPlan,
): Promise<
  | { ok: true; persisted: boolean; storage: "blob" | "file" }
  | { ok: false; error: string; hint?: string }
> {
  // Keep any newer MCP-refreshed metric values from the repo file.
  const fromFile = await readPlanFromFile(customerId);
  const merged = fromFile ? mergeCustomerPlans(plan, fromFile) : plan;

  const normalized: CustomerPlan = {
    ...merged,
    customerId,
    syncedAt: new Date().toISOString(),
  };

  if (hasBlobToken()) {
    try {
      await writePlanToBlob(customerId, normalized);
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
