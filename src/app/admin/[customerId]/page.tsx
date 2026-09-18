import { redirect } from "next/navigation";

type Props = { params: Promise<{ customerId: string }> };

/** Editing lives on the account page itself — keep this URL working. */
export default async function AdminCustomerPage({ params }: Props) {
  const { customerId } = await params;
  redirect(`/c/${customerId}?edit=1`);
}
