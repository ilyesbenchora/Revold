import { redirect } from "next/navigation";

/**
 * La page Facturation vit désormais dans Mon compte → Facturation.
 * Redirection en conservant le statut de retour Stripe (?status=success|cancel).
 */
export default async function BillingRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  redirect(`/dashboard/mon-compte/facturation${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}
