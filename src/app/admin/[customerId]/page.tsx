import { AdminPlanEditor } from "@/components/admin-plan-editor";
import { getAdminPassword, getCustomerPlan } from "@/lib/plan/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ customerId: string }> };

export async function generateMetadata({ params }: Props) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  return {
    title: plan ? `Admin · ${plan.displayName}` : "CSM admin",
  };
}

export default async function AdminCustomerPage({ params }: Props) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  if (!plan) notFound();

  return (
    <main className="flex-1">
      <AdminPlanEditor
        initialPlan={plan}
        defaultPassword={
          process.env.NODE_ENV === "production" ? "" : getAdminPassword()
        }
      />
    </main>
  );
}
