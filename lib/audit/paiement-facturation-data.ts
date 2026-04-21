/**
 * Shared data layer for the Audit > Paiement & Facturation section.
 *
 * Fetches HubSpot invoices + subscriptions in parallel and returns
 * pre-computed KPIs (MRR, ARR, churn, paid/unpaid totals, etc.).
 *
 * Used by:
 *   - /dashboard/audit/paiement-facturation (Vue d'ensemble)
 *   - /dashboard/audit/paiement-facturation/facturation
 *   - /dashboard/audit/paiement-facturation/paiement
 */

export type InvoiceHS = {
  id: string;
  properties: {
    hs_invoice_status?: string;
    hs_amount_billed?: string;
    hs_amount_paid?: string;
    hs_balance_due?: string;
    hs_currency?: string;
    hs_createdate?: string;
    hs_due_date?: string;
  };
};

export type SubscriptionHS = {
  id: string;
  properties: {
    hs_subscription_status?: string;
    hs_recurring_billing_period?: string;
    hs_amount_total?: string;
    hs_currency?: string;
    hs_billing_frequency?: string;
  };
};

async function fetchAllInvoices(token: string): Promise<InvoiceHS[]> {
  const all: InvoiceHS[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/invoices/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: [
            "hs_invoice_status",
            "hs_amount_billed",
            "hs_amount_paid",
            "hs_balance_due",
            "hs_currency",
            "hs_createdate",
            "hs_due_date",
          ],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      all.push(...(data.results ?? []));
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 10);
  return all;
}

async function fetchAllSubscriptions(token: string): Promise<SubscriptionHS[]> {
  const all: SubscriptionHS[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/subscriptions/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: [
            "hs_subscription_status",
            "hs_recurring_billing_period",
            "hs_amount_total",
            "hs_currency",
            "hs_billing_frequency",
          ],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      all.push(...(data.results ?? []));
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 5);
  return all;
}

export type PaiementFacturationData = {
  invoices: InvoiceHS[];
  subscriptions: SubscriptionHS[];
  hasData: boolean;
  // Subscriptions / MRR
  activeSubsCount: number;
  canceledSubsCount: number;
  mrr: number;
  arr: number;
  churnRate: number | null;
  // Invoices
  paidInvoicesCount: number;
  unpaidInvoicesCount: number;
  totalPaid: number;
  totalUnpaidAmount: number;
  avgInvoice: number | null;
  // Score global de la section
  score: number;
};

export async function fetchPaiementFacturationData(
  token: string | null,
): Promise<PaiementFacturationData> {
  let invoices: InvoiceHS[] = [];
  let subscriptions: SubscriptionHS[] = [];
  if (token) {
    [invoices, subscriptions] = await Promise.all([
      fetchAllInvoices(token),
      fetchAllSubscriptions(token),
    ]);
  }

  const hasData = invoices.length > 0 || subscriptions.length > 0;

  // Subscriptions / MRR
  const activeSubs = subscriptions.filter((s) => s.properties.hs_subscription_status === "active");
  const canceledSubs = subscriptions.filter((s) =>
    ["canceled", "expired", "paused"].includes(s.properties.hs_subscription_status ?? ""),
  );
  const mrr = activeSubs.reduce((sum, s) => {
    const amount = parseFloat(s.properties.hs_amount_total ?? "0");
    const freq = (s.properties.hs_billing_frequency ?? "monthly").toLowerCase();
    if (freq.includes("year") || freq.includes("annu")) return sum + amount / 12;
    if (freq.includes("quarter")) return sum + amount / 3;
    if (freq.includes("week")) return sum + amount * 4.33;
    return sum + amount; // monthly default
  }, 0);
  const arr = mrr * 12;
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
        invoices.reduce((s, i) => s + parseFloat(i.properties.hs_amount_billed ?? "0"), 0) / invoices.length,
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

export const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
export const fmtK = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K €` : `${fmt(n)} €`;
