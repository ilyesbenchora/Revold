/**
 * Source canonique (Supabase) pour la page Audit > Trésorerie.
 *
 * Lit les tables `invoices` + `subscriptions` synchronisées par les
 * connecteurs (Pennylane, Sellsy, Axonaut, QuickBooks…), filtrées par
 * `primary_source = toolKey`, et retourne les KPIs au même format que les
 * versions HubSpot/Stripe (PaiementFacturationData) pour que les pages
 * d'audit restent agnostiques à la source.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InvoiceHS,
  SubscriptionHS,
  PaiementFacturationData,
} from "./paiement-facturation-data";

type CanonicalInvoiceRow = {
  id: string;
  status: string | null;
  currency: string | null;
  amount_total: number | null;
  amount_paid: number | null;
  amount_due: number | null;
  issued_at: string | null;
  due_at: string | null;
};

type CanonicalSubRow = {
  id: string;
  status: string | null;
  currency: string | null;
  mrr: number | null;
};

/** invoices (table canonique) → InvoiceHS (format commun). */
function canonicalInvoiceToHsLike(r: CanonicalInvoiceRow): InvoiceHS {
  return {
    id: r.id,
    properties: {
      hs_invoice_status: r.status ?? undefined, // draft, open, paid, void, uncollectible
      hs_amount_billed: String(r.amount_total ?? 0),
      hs_amount_paid: String(r.amount_paid ?? 0),
      hs_balance_due: String(r.amount_due ?? 0),
      hs_currency: r.currency ?? undefined,
      hs_createdate: r.issued_at ?? undefined,
      hs_due_date: r.due_at ?? undefined,
    },
  };
}

/** subscriptions (table canonique) → SubscriptionHS. Le mrr est déjà mensuel. */
function canonicalSubToHsLike(r: CanonicalSubRow): SubscriptionHS {
  return {
    id: r.id,
    properties: {
      hs_subscription_status: r.status ?? undefined,
      hs_amount_total: String(r.mrr ?? 0),
      hs_currency: r.currency ?? undefined,
      hs_billing_frequency: "monthly", // mrr canonique = déjà normalisé au mois
    },
  };
}

export async function fetchPaiementFacturationFromCanonical(
  supabase: SupabaseClient,
  orgId: string,
  toolKey: string,
): Promise<PaiementFacturationData> {
  // Factures CLIENTS uniquement (direction ≠ 'out') : les factures
  // fournisseurs alimentent le cashflow, pas la synthèse Facturation.
  // Si la migration `direction` n'est pas appliquée, repli sans le filtre.
  let invQuery = await supabase
    .from("invoices")
    .select("id, status, currency, amount_total, amount_paid, amount_due, issued_at, due_at")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .neq("direction", "out")
    .limit(5000);
  if (invQuery.error) {
    invQuery = await supabase
      .from("invoices")
      .select("id, status, currency, amount_total, amount_paid, amount_due, issued_at, due_at")
      .eq("organization_id", orgId)
      .eq("primary_source", toolKey)
      .limit(5000);
  }
  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("id, status, currency, mrr")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .limit(5000);
  const invRows = invQuery.data;

  const invoices = ((invRows ?? []) as CanonicalInvoiceRow[]).map(canonicalInvoiceToHsLike);
  const subscriptions = ((subRows ?? []) as CanonicalSubRow[]).map(canonicalSubToHsLike);

  const hasData = invoices.length > 0 || subscriptions.length > 0;

  // MRR : somme directe du champ canonique `mrr` des abonnements actifs.
  const activeSubRows = ((subRows ?? []) as CanonicalSubRow[]).filter((s) => s.status === "active");
  const mrr = activeSubRows.reduce((sum, s) => sum + (Number(s.mrr) || 0), 0);
  const arr = mrr * 12;

  const activeSubs = subscriptions.filter((s) => s.properties.hs_subscription_status === "active");
  const canceledSubs = subscriptions.filter((s) =>
    ["canceled", "expired", "paused"].includes(s.properties.hs_subscription_status ?? ""),
  );
  const churnRate = subscriptions.length > 0
    ? Math.round((canceledSubs.length / subscriptions.length) * 100)
    : null;

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
