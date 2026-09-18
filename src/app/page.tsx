import { CampaignDashboard } from "@/components/campaign-dashboard";
import { getCampaignReport } from "@/lib/klaviyo/client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialReport = await getCampaignReport();

  return (
    <main className="flex-1">
      <CampaignDashboard initialReport={initialReport} />
    </main>
  );
}
