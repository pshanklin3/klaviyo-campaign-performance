export type SendChannel = "email" | "sms" | "push-notification";

export type CampaignPerformance = {
  id: string;
  name: string;
  channel: SendChannel;
  status: "sent" | "scheduled" | "draft" | "cancelled";
  sentAt: string | null;
  recipients: number;
  delivered: number;
  opensUnique: number;
  openRate: number;
  clicksUnique: number;
  clickRate: number;
  clickToOpenRate: number;
  conversions: number;
  conversionRate: number;
  conversionValue: number;
  revenuePerRecipient: number;
  unsubscribes: number;
  unsubscribeRate: number;
};

export type CampaignSummary = {
  campaignCount: number;
  recipients: number;
  delivered: number;
  opensUnique: number;
  openRate: number;
  clicksUnique: number;
  clickRate: number;
  conversions: number;
  conversionValue: number;
  revenuePerRecipient: number;
};

export type CampaignReport = {
  source: "live" | "mock";
  timeframe: {
    key: "last_30_days";
    start: string;
    end: string;
  };
  accountName: string | null;
  summary: CampaignSummary;
  campaigns: CampaignPerformance[];
  message?: string;
};
