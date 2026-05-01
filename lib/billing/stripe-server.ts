/**
 * Helpers Stripe côté serveur pour le billing Revold.
 *
 * Différent de `lib/integrations/sources/stripe.ts` qui lit le compte Stripe du
 * CLIENT (pour analyser ses invoices côté Audit). Ici on parle du compte Stripe
 * de Revold lui-même (pour facturer nos abonnements SaaS).
 *
 * STRIPE_SECRET_KEY = clé Revold (sk_live_… / sk_test_…), JAMAIS exposée côté client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStripePriceId,
  planFromPriceId,
  TRIAL_PERIOD_DAYS,
  type BillingPeriod,
  type PlanKey,
} from "./plans";

const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    usp.set(k, String(v));
  }
  return usp.toString();
}

async function stripeFetch<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  const res = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Stripe API ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Get-or-create un Stripe Customer pour cette org. */
export async function getOrCreateStripeCustomer(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
  orgName: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("org_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }
  const customer = await stripeFetch<{ id: string }>(
    "/customers",
    {
      method: "POST",
      body: form({
        email,
        name: orgName,
        "metadata[organization_id]": orgId,
      }),
    },
  );
  return customer.id;
}

/**
 * Crée une session Checkout pour souscrire un plan.
 * Trial 14j inclus pour tous les plans, sans pré-autorisation carte.
 */
export async function createCheckoutSession(args: {
  customerId: string;
  plan: PlanKey;
  period: BillingPeriod;
  successUrl: string;
  cancelUrl: string;
  orgId: string;
}): Promise<{ url: string; id: string }> {
  const priceId = getStripePriceId(args.plan, args.period);
  if (!priceId) {
    throw new Error(`Stripe Price ID non configuré pour ${args.plan}/${args.period}`);
  }
  const session = await stripeFetch<{ id: string; url: string }>(
    "/checkout/sessions",
    {
      method: "POST",
      body: form({
        customer: args.customerId,
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        "subscription_data[trial_period_days]": TRIAL_PERIOD_DAYS,
        "subscription_data[metadata][organization_id]": args.orgId,
        "subscription_data[metadata][plan]": args.plan,
        "subscription_data[metadata][period]": args.period,
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: "required",
        // Pas de payment_method_collection: 'always' → Stripe demande la CB en fin de trial uniquement
        "payment_method_collection": "if_required",
      }),
    },
  );
  return session;
}

/** Crée une session Customer Portal pour gérer/annuler son abonnement. */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const session = await stripeFetch<{ url: string }>(
    "/billing_portal/sessions",
    {
      method: "POST",
      body: form({
        customer: customerId,
        return_url: returnUrl,
      }),
    },
  );
  return session;
}

/**
 * Synchronise un Stripe.Subscription dans org_subscriptions (called from webhook).
 * Idempotent : ON CONFLICT (organization_id) UPDATE.
 */
export async function upsertSubscriptionFromStripe(
  supabase: SupabaseClient,
  sub: {
    id: string;
    customer: string;
    status: string;
    trial_end: number | null;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    canceled_at: number | null;
    items: { data: Array<{ price: { id: string } }> };
    metadata: Record<string, string | undefined>;
  },
): Promise<void> {
  const orgId = sub.metadata.organization_id;
  if (!orgId) {
    console.warn("[stripe webhook] subscription sans metadata.organization_id:", sub.id);
    return;
  }
  const priceId = sub.items.data[0]?.price.id;
  const planMatch = priceId ? planFromPriceId(priceId) : null;
  const plan = planMatch?.plan ?? (sub.metadata.plan as PlanKey | undefined);
  const period = planMatch?.period ?? (sub.metadata.period as BillingPeriod | undefined) ?? "monthly";
  if (!plan) {
    console.error("[stripe webhook] plan introuvable pour subscription:", sub.id);
    return;
  }

  const toIso = (s: number | null) => (s ? new Date(s * 1000).toISOString() : null);

  const { error } = await supabase
    .from("org_subscriptions")
    .upsert(
      {
        organization_id: orgId,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId ?? null,
        plan,
        billing_period: period,
        status: sub.status,
        trial_end: toIso(sub.trial_end),
        current_period_start: toIso(sub.current_period_start),
        current_period_end: toIso(sub.current_period_end),
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: toIso(sub.canceled_at),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
  if (error) {
    console.error("[stripe webhook] upsert org_subscription failed:", error.message);
    throw error;
  }
}

/**
 * Vérifie la signature d'un payload webhook Stripe.
 * Pas d'import du SDK Stripe pour rester léger — implémentation HMAC-SHA256.
 */
export async function verifyStripeWebhook(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const tsNum = parseInt(ts, 10);
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;
  const signedPayload = `${ts}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Comparaison constant-time
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
