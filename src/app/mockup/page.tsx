import { getCustomerPlan } from "@/lib/plan/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MockupRedirectPage() {
  const plan = await getCustomerPlan("hunter-trading");
  if (plan) redirect("/c/hunter-trading");
  redirect("/");
}
