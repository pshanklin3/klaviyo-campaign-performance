export type CustomerId = string;

/** What kind of Klaviyo object the experiment metric is pulled from. */
export type ExperimentMetricScope =
  | "flow_message"
  | "flow"
  | "campaign"
  | "aggregate";

/** Supported pullable metrics (extend as MCP coverage grows). */
export type ExperimentMetricKey =
  | "click_rate"
  | "open_rate"
  | "placed_order_rate"
  | "attributed_revenue"
  | "revenue_per_recipient"
  | "recipients"
  | "unsubscribe_rate";

/**
 * How to resolve benchmark vs current for an experiment.
 * Values on the card are filled by a Klaviyo pull using this config —
 * not typed in by hand (except temporary manual override).
 */
export type ExperimentMetricPull = {
  scope: ExperimentMetricScope;
  metricKey: ExperimentMetricKey;
  /** Flow message / flow / campaign id (or empty for account aggregate). */
  objectId: string;
  objectLabel?: string;
  /** Lookback window ending at changedOn for the benchmark. */
  benchmarkDays: number;
  /** When false, card values can be edited manually as a fallback. */
  autoPull: boolean;
};

export type Experiment = {
  id: string;
  name: string;
  klaviyoUrl: string;
  itemType: "Flow message" | "Campaign" | "Form" | "Other";
  goal: string;
  implemented: string;
  /** Go-live / change date — also the split for before vs after metrics. */
  changedOn: string;
  metricPull: ExperimentMetricPull;
  /** Cached display fields — written by pull (or manual if autoPull is false). */
  metricLabel: string;
  benchmarkValue: string;
  benchmarkNote: string;
  currentValue: string;
  currentNote: string;
  deltaPct: number;
  lastPulledAt?: string;
};

export type Goal = {
  id: string;
  statement: string;
  progressPct: number;
  detail: string;
};

export type Task = {
  id: string;
  title: string;
  owner: string;
  status: "In progress" | "Blocked" | "Done";
};

export type MeetingNote = {
  id: string;
  date: string;
  title: string;
  summary: string;
  nextSteps: string[];
};

export type ProductRequest = {
  id: string;
  name: string;
  status: string;
};

export type SupportTicket = {
  id: string;
  title: string;
  meta: string;
};

export type OverviewMetric = {
  label: string;
  value: string;
  priorDeltaPct: number;
  yoyDeltaPct: number;
};

export type PeriodRow = {
  window: string;
  ecom: string;
  ecomPriorPct: number;
  ecomYoyPct: number;
  attributed: string;
  attrPriorPct: number;
  attrYoyPct: number;
};

export type CustomerPlan = {
  customerId: CustomerId;
  displayName: string;
  syncedAt: string;
  callout: string;
  overview: {
    ecomL30: OverviewMetric;
    ecomYesterday: OverviewMetric;
    attributedL30: OverviewMetric;
    attributedYesterday: OverviewMetric;
    ecomL7: OverviewMetric;
    attributedL7: OverviewMetric;
    emailSharePct: number;
    campaignSharePct: number;
  };
  periods: PeriodRow[];
  continueItems: string[];
  investigateItems: string[];
  experiments: Experiment[];
  goals: Goal[];
  tasks: Task[];
  meeting: MeetingNote | null;
  productRequests: ProductRequest[];
  tickets: SupportTicket[];
  modules: string[];
};

export function emptyPlan(customerId: string, displayName: string): CustomerPlan {
  return {
    customerId,
    displayName,
    syncedAt: new Date().toISOString(),
    callout: "",
    overview: {
      ecomL30: {
        label: "Ecom revenue · last 30 days",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      ecomYesterday: {
        label: "Ecom revenue · yesterday",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      attributedL30: {
        label: "Attributed revenue · last 30 days",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      attributedYesterday: {
        label: "Attributed revenue · yesterday",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      ecomL7: {
        label: "Ecom · last 7 days",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      attributedL7: {
        label: "Attributed · last 7 days",
        value: "$0",
        priorDeltaPct: 0,
        yoyDeltaPct: 0,
      },
      emailSharePct: 50,
      campaignSharePct: 50,
    },
    periods: [],
    continueItems: [],
    investigateItems: [],
    experiments: [],
    goals: [],
    tasks: [],
    meeting: null,
    productRequests: [],
    tickets: [],
    modules: [
      "Campaigns",
      "Flows",
      "List growth",
      "Signup forms",
      "Segments",
    ],
  };
}
