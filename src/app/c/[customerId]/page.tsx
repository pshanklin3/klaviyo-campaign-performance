import { CustomerAccountView } from "@/components/customer-account-view";
import {
  getAdminPassword,
  getCustomerPlan,
  getStorageMode,
} from "@/lib/plan/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { customerId } = await params;
  const plan = await getCustomerPlan(customerId);
  return {
    title: plan ? `${plan.displayName} · Account` : "Customer account",
  };
}

export default async function CustomerPage({ params, searchParams }: Props) {
  const { customerId } = await params;
  const { edit } = await searchParams;
  const plan = await getCustomerPlan(customerId);
  if (!plan) notFound();

  return (
    <main className="flex-1">
      <CustomerAccountView
        initialPlan={plan}
        storageMode={getStorageMode()}
        startEditing={edit === "1" || edit === "true"}
        defaultPassword={
          process.env.NODE_ENV === "production" ? "" : getAdminPassword()
        }
      />
    </main>
  );
}
