import { CustomerAccountView } from "@/components/customer-account-view";
import { getCustomerPlan } from "@/lib/plan/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ customerId: string }> };

export async function generateMetadata({ params }: Props) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  return {
    title: plan
      ? `${plan.displayName} · Account`
      : "Customer account",
  };
}

export default async function CustomerPage({ params }: Props) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  if (!plan) notFound();

  return (
    <main className="flex-1">
      <CustomerAccountView plan={plan} showAdminLink />
    </main>
  );
}
