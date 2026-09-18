import { AccountMockup } from "@/components/account-mockup";

export const metadata = {
  title: "Account mockup · Performance + Success plan",
  description:
    "Static mockup of customer-facing performance executive strip and success plan.",
};

export default function MockupPage() {
  return (
    <main className="flex-1">
      <AccountMockup />
    </main>
  );
}
