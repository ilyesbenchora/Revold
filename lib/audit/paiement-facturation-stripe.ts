/**
 * Source Stripe pour la page Audit > Paiement & Facturation.
 *
 * Lit Stripe live (invoices + subscriptions) et retourne les KPIs au même
 * format que la version HubSpot (PaiementFacturationData), pour que les
 * pages d'audit soient agnostiques à la source.
 */

import {
  listInvoices,
  listSubscriptions,
  computeMrr,
  type StripeInvoice,
  type StripeSubscription,
} from "@/lib/integrations/sources/stripe";
import type {
  InvoiceHS,
  SubscriptionHS,
  PaiementFacturationData,
} from "./paiement-facturation-data";

/** Stripe.invoice → InvoiceHS (mapping vers le format commun). */
function stripeInvoiceToHsLike(inv: StripeInvoice): InvoiceHS {
  // Stripe stocke les montants en cents → on convertit en unité majeure.
  const billed = (inv.total / 100).toString();
  const paid = (inv.amount_paid / 100).toString();
  const balance = (inv.amount_due / 100).toString();
  return {
    id: inv.id,
    properties: {
      hs_invoice_status: inv.status, // "paid" | "open" | "void" | "uncollectible" | "draft"
      hs_amount_billed: billed,
      hs_amount_paid: paid,
      hs_balance_due: balance,
      hs_currency: inv.currency,
      hs_createdate: inv.created ? new Date(inv.created * 1000).toISOString() : undefined,
      hs_due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : undefined,
    },
  };
}

/** Stripe.subscription → SubscriptionHS. */
function stripeSubToHsLike(sub: StripeSubscription): SubscriptionHS {
  // Map des statuts Stripe → HubSpot (`active`, `canceled`, `paused`, `expired`, `trialing`, `past_due`)
  const statusMap: Record<StripeSubscription["status"], string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "past_due",
    incomplete_expired: "expired",
    unpaid: "past_due",
    paused: "paused",
  };
  const item = sub.items.data[0];
  const recur = item?.price.recurring;
  // hs_billing_frequency = "monthly" | "annually" | "weekly" | "quarterly"
  const frequency = recur?.interval === "year"
    ? "annually"
    : recur?.interval === "month" && recur.interval_count === 3
      ? "quarterly"
      : recur?.interval === "week"
        ? "weekly"
        : "monthly";
  // hs_amount_total = total période (= mrr × interval_count quand monthly, etc.)
  const mrr = computeMrr(sub);
  // On stocke le total période pour rester cohérent avec ce que ferait HubSpot
  const totalPeriod = recur?.interval === "year"
    ? mrr * 12
    : recur?.interval === "month"
      ? mrr * (recur.interval_count ?? 1)
      : mrr;
  return {
    id: sub.id,
    properties: {
      hs_subscription_status: statusMap[sub.status] ?? sub.status,
      hs_amount_total: totalPeriod.toString(),
      hs_currency: sub.currency,
      hs_billing_frequency: frequency,
    },
  };
}

export async function fetchPaiementFacturationFromStripe(
  stripeKey: string | null,
): Promise<PaiementFacturationData> {
  let stripeInvoices: StripeInvoice[] = [];
  let stripeSubs: StripeSubscription[] = [];
  if (stripeKey) {
    try {
      [stripeInvoices, stripeSubs] = await Promise.all([
        listInvoices(stripeKey, 2000).catch(() => []),
        listSubscriptions(stripeKey, 1000).catch(() => []),
      ]);
    } catch {
      // Fallback : valeurs vides si Stripe down
    }
  }

  const invoices = stripeInvoices.map(stripeInvoiceToHsLike);
  const subscriptions = stripeSubs.map(stripeSubToHsLike);

  const hasData = invoices.length > 0 || subscriptions.length > 0;

  // MRR : on utilise le calcul Stripe natif (computeMrr) plutôt que de recalculer
  // depuis hs_amount_total + hs_billing_frequency, plus précis.
  const mrr = stripeSubs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + computeMrr(s), 0);
  const arr = mrr * 12;

  const activeSubs = subscriptions.filter((s) => s.properties.hs_subscription_status === "active");
  const canceledSubs = subscriptions.filter((s) =>
    ["canceled", "expired", "paused"].includes(s.properties.hs_subscription_status ?? ""),
  );
  const churnRate = subscriptions.length > 0
    ? Math.round((canceledSubs.length / subscriptions.length) * 100)
    : null;

  // Invoices
  const paidInvoices = invoices.filter((i) => i.properties.hs_invoice_status === "paid");
  const unpaidInvoices = invoices.filter((i) =>
    ["open", "uncollectible", "draft"].includes(i.properties.hs_invoice_status ?? ""),
  );
  const totalPaid = paidInvoices.reduce(
    (s, i) => s + parseFloat(i.properties.hs_amount_paid ?? i.properties.hs_amount_billed ?? "0"),
    0,
  );
  const totalUnpaidAmount = unpaidInvoices.reduce(
    (s, i) => s + parseFloat(i.properties.hs_balance_due ?? i.properties.hs_amount_billed ?? "0"),
    0,
  );
  const avgInvoice = invoices.length > 0
    ? Math.round(
        invoices.reduce((s, i) => s + parseFloat(i.properties.hs_amount_billed ?? "0"), 0) /
          invoices.length,
      )
    : null;

  const score = hasData
    ? Math.round(
        (paidInvoices.length > 0
          ? Math.min(100, (paidInvoices.length / Math.max(invoices.length, 1)) * 100)
          : 50) * 0.3 +
          Math.max(0, 100 - (churnRate ?? 10) * 5) * 0.3 +
          (mrr > 0 ? 80 : 0) * 0.2 +
          (unpaidInvoices.length === 0 ? 100 : unpaidInvoices.length < 5 ? 60 : 20) * 0.2,
      )
    : 0;

  return {
    invoices,
    subscriptions,
    hasData,
    activeSubsCount: activeSubs.length,
    canceledSubsCount: canceledSubs.length,
    mrr,
    arr,
    churnRate,
    paidInvoicesCount: paidInvoices.length,
    unpaidInvoicesCount: unpaidInvoices.length,
    totalPaid,
    totalUnpaidAmount,
    avgInvoice,
    score,
  };
}
