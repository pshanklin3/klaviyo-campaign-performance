import { CampaignDashboard } from "@/components/campaign-dashboard";
import { getCampaignReport } from "@/lib/klaviyo/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialReport = await getCampaignReport();

  return (
    <main className="flex-1">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-4 px-4 pt-4 text-sm sm:px-6 lg:px-8">
        <Link
          href="/c/hunter-trading"
          className="font-medium text-[color:var(--accent-strong)] underline-offset-4 hover:underline"
        >
          Customer view · Hunter Trading →
        </Link>
        <Link
          href="/admin/hunter-trading"
          className="font-medium text-[color:var(--accent-strong)] underline-offset-4 hover:underline"
        >
          CSM admin →
        </Link>
      </div>
      <CampaignDashboard initialReport={initialReport} />
    </main>
  );
}
