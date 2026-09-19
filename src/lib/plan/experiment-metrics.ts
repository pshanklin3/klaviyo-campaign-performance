import type {
  Experiment,
  ExperimentMetricKey,
  ExperimentMetricPull,
  ExperimentMetricScope,
} from "./types";

export const METRIC_SCOPE_OPTIONS: {
  value: ExperimentMetricScope;
  label: string;
  hint: string;
}[] = [
  {
    value: "flow_message",
    label: "Flow message",
    hint: "One message inside a flow (e.g. Browse Abandon Email 2)",
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
    value: "aggregate",
    label: "Account aggregate",
    hint: "Account-level metric (not tied to one message)",
  },
];

export const METRIC_KEY_OPTIONS: {
  value: ExperimentMetricKey;
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
];

export function metricKeyLabel(key: ExperimentMetricKey): string {
  return METRIC_KEY_OPTIONS.find((o) => o.value === key)?.label ?? key;
}

export function defaultMetricPull(
  itemType: Experiment["itemType"],
): ExperimentMetricPull {
  const scope: ExperimentMetricScope =
    itemType === "Campaign"
      ? "campaign"
      : itemType === "Flow message"
        ? "flow_message"
        : "aggregate";
  return {
    scope,
    metricKey: "click_rate",
    objectId: "",
    objectLabel: "",
    benchmarkDays: 30,
    autoPull: true,
  };
}

/** Normalize older plan JSON that predates metricPull. */
export function ensureExperimentMetricPull(
  experiment: Omit<Experiment, "metricPull"> & {
    metricPull?: ExperimentMetricPull;
  },
): Experiment {
  if (experiment.metricPull) {
    return experiment as Experiment;
  }
  return {
    ...experiment,
    metricPull: {
      ...defaultMetricPull(experiment.itemType),
      autoPull: false,
    },
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
