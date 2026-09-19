import type {
  Experiment,
  ExperimentItemType,
  ExperimentMetricCombine,
  ExperimentMetricPull,
  ExperimentMetricRef,
  ExperimentMetricScope,
} from "./types";

export const EXPERIMENT_ITEM_TYPE_OPTIONS: ExperimentItemType[] = [
  "Flow message",
  "Campaign",
  "Form",
  "SMS",
  "Segment",
  "List",
  "Account",
  "Other",
];

export const METRIC_SCOPE_OPTIONS: {
  value: ExperimentMetricScope;
  label: string;
  hint: string;
}[] = [
  {
    value: "flow_message",
    label: "Flow message",
    hint: "One message inside a flow",
  },
  {
    value: "flow",
    label: "Flow (all messages)",
    hint: "Whole-flow aggregate performance",
  },
  {
    value: "campaign",
    label: "Campaign",
    hint: "A single campaign send",
  },
  {
    value: "form",
    label: "Signup form",
    hint: "Form submit / conversion metrics",
  },
  {
    value: "segment",
    label: "Segment",
    hint: "Segment size or engagement for a segment",
  },
  {
    value: "list",
    label: "List",
    hint: "List growth / subscribe metrics",
  },
  {
    value: "account",
    label: "Account aggregate",
    hint: "Account-level metric(s), not tied to one message",
  },
  {
    value: "custom",
    label: "Custom / other",
    hint: "Anything else — describe the object and metrics below",
  },
];

export const METRIC_COMBINE_OPTIONS: {
  value: ExperimentMetricCombine;
  label: string;
}[] = [
  { value: "single", label: "Single metric" },
  { value: "sum", label: "Sum of metrics" },
  { value: "average", label: "Average of metrics" },
  { value: "ratio", label: "Ratio (first ÷ second)" },
  { value: "custom", label: "Custom formula" },
];

/** Common shortcuts only — not an exhaustive catalog. */
export const METRIC_PRESET_OPTIONS: {
  value: string;
  label: string;
  format: "percent" | "currency" | "number";
}[] = [
  { value: "click_rate", label: "Click rate", format: "percent" },
  { value: "open_rate", label: "Open rate", format: "percent" },
  { value: "placed_order_rate", label: "Placed order rate", format: "percent" },
  {
    value: "attributed_revenue",
    label: "Attributed revenue",
    format: "currency",
  },
  {
    value: "revenue_per_recipient",
    label: "Revenue / recipient",
    format: "currency",
  },
  { value: "recipients", label: "Recipients", format: "number" },
  {
    value: "unsubscribe_rate",
    label: "Unsubscribe rate",
    format: "percent",
  },
  { value: "custom", label: "Custom metric / aggregate…", format: "number" },
];

export function presetLabel(preset: string): string {
  return METRIC_PRESET_OPTIONS.find((o) => o.value === preset)?.label ?? preset;
}

export function pullDisplayLabel(pull: ExperimentMetricPull): string {
  return pull.goalMetricLabel?.trim() || presetLabel(pull.preset) || "Metric";
}

function refsFromPreset(preset: string): {
  label: string;
  metrics: ExperimentMetricRef[];
  combine: ExperimentMetricCombine;
} {
  if (preset === "custom") {
    return {
      label: "Custom metric",
      metrics: [{ label: "" }],
      combine: "custom",
    };
  }
  const label = presetLabel(preset);
  return {
    label,
    metrics: [{ label }],
    combine: "single",
  };
}

export function defaultMetricPull(
  itemType: ExperimentItemType,
): ExperimentMetricPull {
  const scope: ExperimentMetricScope =
    itemType === "Campaign"
      ? "campaign"
      : itemType === "Flow message"
        ? "flow_message"
        : itemType === "Form"
          ? "form"
          : itemType === "Segment"
            ? "segment"
            : itemType === "List"
              ? "list"
              : itemType === "Account"
                ? "account"
                : itemType === "SMS"
                  ? "flow_message"
                  : "custom";
  const fromPreset = refsFromPreset("click_rate");
  return {
    scope,
    preset: "click_rate",
    goalMetricLabel: fromPreset.label,
    metrics: fromPreset.metrics,
    combine: fromPreset.combine,
    combineNote: "",
    objectId: "",
    objectLabel: "",
    benchmarkDays: 30,
    autoPull: true,
  };
}

type LegacyPull = Partial<ExperimentMetricPull> & {
  metricKey?: string;
};

/** Normalize older plan JSON (metricKey-only or missing metricPull). */
export function ensureExperimentMetricPull(
  experiment: Omit<Experiment, "metricPull" | "itemType"> & {
    itemType: string;
    metricPull?: LegacyPull;
  },
): Experiment {
  const itemType = (EXPERIMENT_ITEM_TYPE_OPTIONS.includes(
    experiment.itemType as ExperimentItemType,
  )
    ? experiment.itemType
    : "Other") as ExperimentItemType;

  const legacy = experiment.metricPull;
  if (legacy && legacy.goalMetricLabel && Array.isArray(legacy.metrics)) {
    return {
      ...experiment,
      itemType,
      metricPull: {
        scope: legacy.scope ?? "custom",
        preset: legacy.preset ?? legacy.metricKey ?? "custom",
        goalMetricLabel: legacy.goalMetricLabel,
        metrics:
          legacy.metrics.length > 0
            ? legacy.metrics
            : [{ label: legacy.goalMetricLabel }],
        combine: legacy.combine ?? "single",
        combineNote: legacy.combineNote ?? "",
        objectId: legacy.objectId ?? "",
        objectLabel: legacy.objectLabel ?? "",
        benchmarkDays: legacy.benchmarkDays ?? 30,
        autoPull: legacy.autoPull ?? true,
      },
    };
  }

  if (legacy?.metricKey) {
    const fromPreset = refsFromPreset(legacy.metricKey);
    return {
      ...experiment,
      itemType,
      metricPull: {
        scope: legacy.scope ?? defaultMetricPull(itemType).scope,
        preset: legacy.metricKey,
        goalMetricLabel: fromPreset.label,
        metrics: fromPreset.metrics,
        combine: fromPreset.combine,
        combineNote: "",
        objectId: legacy.objectId ?? "",
        objectLabel: legacy.objectLabel ?? "",
        benchmarkDays: legacy.benchmarkDays ?? 30,
        autoPull: legacy.autoPull ?? true,
      },
      metricLabel: experiment.metricLabel || fromPreset.label,
    };
  }

  const pull = defaultMetricPull(itemType);
  return {
    ...experiment,
    itemType,
    metricPull: { ...pull, autoPull: false },
  };
}

export function applyPresetToPull(
  pull: ExperimentMetricPull,
  preset: string,
): ExperimentMetricPull {
  if (preset === "custom") {
    return {
      ...pull,
      preset: "custom",
      combine: pull.combine === "single" ? "custom" : pull.combine,
      goalMetricLabel: pull.goalMetricLabel || "",
      metrics: pull.metrics.length > 0 ? pull.metrics : [{ label: "" }],
    };
  }
  const fromPreset = refsFromPreset(preset);
  return {
    ...pull,
    preset,
    goalMetricLabel: fromPreset.label,
    metrics: fromPreset.metrics,
    combine: fromPreset.combine,
  };
}

/**
 * Resolve benchmark window: [changedOn - benchmarkDays, changedOn)
 * and current window: [changedOn, today].
 * Actual Klaviyo fetch is wired via MCP / API later.
 */
export function describeMetricWindows(experiment: Experiment): {
  benchmark: string;
  current: string;
} {
  const pull = experiment.metricPull;
  const days = pull?.benchmarkDays ?? 30;
  return {
    benchmark: `${days}d before ${experiment.changedOn}`,
    current: `Since ${experiment.changedOn}`,
  };
}
