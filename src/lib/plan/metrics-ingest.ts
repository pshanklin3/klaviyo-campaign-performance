import type {
  CustomerPlan,
  Experiment,
  OverviewMetric,
  PeriodRow,
} from "@/lib/plan/types";

/** Partial overview metric — only provided fields are applied. */
export type OverviewMetricPatch = Partial<OverviewMetric>;

export type ExperimentMetricPatch = {
  /** Experiment id (required). */
  id: string;
  metricLabel?: string;
  benchmarkValue?: string;
  benchmarkNote?: string;
  currentValue?: string;
  currentNote?: string;
  deltaPct?: number;
  lastPulledAt?: string;
};

/**
 * Body for POST /api/customers/:id/metrics/ingest
 * Agents (Claude, Cursor, …) pull via Klaviyo MCP, then POST numbers here.
 */
export type MetricsIngestBody = {
  /** Defaults to now. Used for overview merge freshness. */
  syncedAt?: string;
  callout?: string;
  overview?: {
    ecomL30?: OverviewMetricPatch;
    ecomYesterday?: OverviewMetricPatch;
    attributedL30?: OverviewMetricPatch;
    attributedYesterday?: OverviewMetricPatch;
    ecomL7?: OverviewMetricPatch;
    attributedL7?: OverviewMetricPatch;
    emailSharePct?: number;
    campaignSharePct?: number;
  };
  /** Replace matching windows by `window` name; leave others untouched. */
  periods?: PeriodRow[];
  experiments?: ExperimentMetricPatch[];
};

function mergeOverviewMetric(
  base: OverviewMetric,
  patch?: OverviewMetricPatch,
): OverviewMetric {
  if (!patch) return base;
  return {
    label: patch.label ?? base.label,
    value: patch.value ?? base.value,
    priorDeltaPct:
      typeof patch.priorDeltaPct === "number"
        ? patch.priorDeltaPct
        : base.priorDeltaPct,
    yoyDeltaPct:
      typeof patch.yoyDeltaPct === "number"
        ? patch.yoyDeltaPct
        : base.yoyDeltaPct,
  };
}

function mergePeriods(
  existing: PeriodRow[],
  incoming: PeriodRow[] | undefined,
): PeriodRow[] {
  if (!incoming?.length) return existing;
  const byWindow = new Map(existing.map((row) => [row.window, row]));
  for (const row of incoming) {
    const prev = byWindow.get(row.window);
    byWindow.set(row.window, prev ? { ...prev, ...row } : row);
  }
  // Preserve existing order; append any new windows at the end.
  const seen = new Set<string>();
  const next: PeriodRow[] = [];
  for (const row of existing) {
    const updated = byWindow.get(row.window);
    if (updated) {
      next.push(updated);
      seen.add(row.window);
    }
  }
  for (const row of incoming) {
    if (!seen.has(row.window)) next.push(row);
  }
  return next;
}

function mergeExperiment(
  experiment: Experiment,
  patch: ExperimentMetricPatch,
  pulledAt: string,
): Experiment {
  return {
    ...experiment,
    metricLabel: patch.metricLabel ?? experiment.metricLabel,
    benchmarkValue: patch.benchmarkValue ?? experiment.benchmarkValue,
    benchmarkNote: patch.benchmarkNote ?? experiment.benchmarkNote,
    currentValue: patch.currentValue ?? experiment.currentValue,
    currentNote: patch.currentNote ?? experiment.currentNote,
    deltaPct:
      typeof patch.deltaPct === "number" ? patch.deltaPct : experiment.deltaPct,
    lastPulledAt: patch.lastPulledAt ?? pulledAt,
  };
}

export type MetricsIngestResult = {
  plan: CustomerPlan;
  updated: {
    overview: boolean;
    periods: string[];
    experiments: string[];
    callout: boolean;
  };
  missingExperimentIds: string[];
};

/** Apply an MCP-sourced metrics patch onto a customer plan. */
export function applyMetricsIngest(
  plan: CustomerPlan,
  body: MetricsIngestBody,
): MetricsIngestResult {
  const syncedAt = body.syncedAt?.trim() || new Date().toISOString();
  const updated = {
    overview: false,
    periods: [] as string[],
    experiments: [] as string[],
    callout: false,
  };

  let next: CustomerPlan = { ...plan, syncedAt };

  if (typeof body.callout === "string") {
    next = { ...next, callout: body.callout };
    updated.callout = true;
  }

  if (body.overview) {
    const o = body.overview;
    next = {
      ...next,
      overview: {
        ecomL30: mergeOverviewMetric(plan.overview.ecomL30, o.ecomL30),
        ecomYesterday: mergeOverviewMetric(
          plan.overview.ecomYesterday,
          o.ecomYesterday,
        ),
        attributedL30: mergeOverviewMetric(
          plan.overview.attributedL30,
          o.attributedL30,
        ),
        attributedYesterday: mergeOverviewMetric(
          plan.overview.attributedYesterday,
          o.attributedYesterday,
        ),
        ecomL7: mergeOverviewMetric(plan.overview.ecomL7, o.ecomL7),
        attributedL7: mergeOverviewMetric(
          plan.overview.attributedL7,
          o.attributedL7,
        ),
        emailSharePct:
          typeof o.emailSharePct === "number"
            ? o.emailSharePct
            : plan.overview.emailSharePct,
        campaignSharePct:
          typeof o.campaignSharePct === "number"
            ? o.campaignSharePct
            : plan.overview.campaignSharePct,
      },
    };
    updated.overview = true;
  }

  if (body.periods?.length) {
    next = { ...next, periods: mergePeriods(plan.periods, body.periods) };
    updated.periods = body.periods.map((p) => p.window);
  }

  const missingExperimentIds: string[] = [];
  if (body.experiments?.length) {
    const patches = new Map(body.experiments.map((p) => [p.id, p]));
    next = {
      ...next,
      experiments: plan.experiments.map((exp) => {
        const patch = patches.get(exp.id);
        if (!patch) return exp;
        updated.experiments.push(exp.id);
        return mergeExperiment(exp, patch, syncedAt);
      }),
    };
    for (const patch of body.experiments) {
      if (!plan.experiments.some((e) => e.id === patch.id)) {
        missingExperimentIds.push(patch.id);
      }
    }
  }

  return { plan: next, updated, missingExperimentIds };
}

/** Example body for agent docs / GET schema. */
export function metricsIngestExample(customerId: string): MetricsIngestBody {
  return {
    syncedAt: new Date().toISOString(),
    callout: `Live Klaviyo metrics refreshed for ${customerId}.`,
    overview: {
      attributedL30: {
        value: "$658K",
        priorDeltaPct: 41.5,
        yoyDeltaPct: 0,
      },
      attributedYesterday: {
        value: "$18.3K",
        priorDeltaPct: 107.9,
        yoyDeltaPct: 0,
      },
      attributedL7: {
        value: "$132K",
        priorDeltaPct: -6.9,
        yoyDeltaPct: 0,
      },
      emailSharePct: 63,
      campaignSharePct: 61,
    },
    periods: [
      {
        window: "Last 30 days",
        ecom: "—",
        ecomPriorPct: 0,
        ecomYoyPct: 0,
        attributed: "$658K",
        attrPriorPct: 41.5,
        attrYoyPct: 0,
      },
    ],
    experiments: [
      {
        id: "exp-sms-campaigns",
        benchmarkValue: "2.30%",
        currentValue: "2.60%",
        deltaPct: 12.8,
        lastPulledAt: new Date().toISOString(),
      },
    ],
  };
}
