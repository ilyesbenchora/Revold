/**
 * POST /api/billing/checkout
 *
 * Body: { plan: "starter" | "growth" | "scale", period: "monthly" | "yearly" }
 *
 * Crée une session Stripe Checkout (avec trial 14j) pour l'org du user connecté.
 * Renvoie { url } pour rediriger côté client.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOrgId } from "@/lib/supabase/cached";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
} from "@/lib/billing/stripe-server";
import type { PlanKey, BillingPeriod } from "@/lib/billing/plans";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const { plan, period } = (await req.json().catch(() => ({}))) as {
    plan?: PlanKey;
    period?: BillingPeriod;
  };
  if (!plan || !["starter", "growth", "scale"].includes(plan)) {
    return NextResponse.json({ error: "plan invalide" }, { status: 400 });
  }
  if (!period || !["monthly", "yearly"].includes(period)) {
    return NextResponse.json({ error: "période invalide" }, { status: 400 });
  }

  const supabase = adminClient();

  // Récupère email + nom de l'org pour pré-remplir le Stripe Customer
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  const { data: authUser } = profile?.id
    ? await supabase.auth.admin.getUserById(profile.id as string)
    : { data: null };
  const email = authUser?.user?.email ?? "";

  try {
    const customerId = await getOrCreateStripeCustomer(
      supabase,
      orgId,
      email,
      org?.name ?? "Revold customer",
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io";
    const session = await createCheckoutSession({
      customerId,
      plan,
      period,
      orgId,
      successUrl: `${baseUrl}/dashboard/parametres/billing?status=success`,
      cancelUrl: `${baseUrl}/dashboard/parametres/billing?status=cancel`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur Stripe";
    console.error("[billing/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
