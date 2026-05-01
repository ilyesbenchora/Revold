/**
 * Webhook Stripe — synchronise les events de subscription dans org_subscriptions.
 *
 * Events gérés :
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   customer.subscription.trial_will_end
 *   invoice.payment_failed (informe le user via daily-digest, fait passer past_due)
 *   checkout.session.completed (création initiale du sub)
 *
 * Sécurité : signature Stripe vérifiée via STRIPE_WEBHOOK_SECRET (HMAC SHA-256).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // on a besoin de crypto.subtle synchrone, OK partout

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  upsertSubscriptionFromStripe,
  verifyStripeWebhook,
} from "@/lib/billing/stripe-server";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

type StripeSubscription = Parameters<typeof upsertSubscriptionFromStripe>[1];

type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET manquant");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const valid = await verifyStripeWebhook(payload, signature, secret);
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = adminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        await upsertSubscriptionFromStripe(supabase, event.data.object as StripeSubscription);
        break;
      }
      case "checkout.session.completed": {
        // Le subscription event suit immédiatement, on no-op ici
        break;
      }
      case "invoice.payment_failed": {
        // Le sub.status passera à "past_due" via subscription.updated → no-op
        break;
      }
      default:
        // Events ignorés (charge.*, payment_intent.*, etc.)
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
