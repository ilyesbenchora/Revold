/**
 * POST /api/billing/portal
 *
 * Crée une session Stripe Customer Portal pour gérer / annuler son abo.
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOrgId } from "@/lib/supabase/cached";
import { createPortalSession } from "@/lib/billing/stripe-server";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST() {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: sub } = await supabase
    .from("org_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif. Souscrivez un plan d'abord." },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io";
  try {
    const session = await createPortalSession(
      sub.stripe_customer_id as string,
      `${baseUrl}/dashboard/parametres/billing`,
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur Stripe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
