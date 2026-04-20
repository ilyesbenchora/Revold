export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const fmtK = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K €` : `${fmt(n)} €`;

type InvoiceHS = {
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

type SubscriptionHS = {
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

export default async function PaiementFacturationPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  let invoices: InvoiceHS[] = [];
  let subscriptions: SubscriptionHS[] = [];
  if (token) {
    [invoices, subscriptions] = await Promise.all([
      fetchAllInvoices(token),
      fetchAllSubscriptions(token),
    ]);
  }

  const hasData = invoices.length > 0 || subscriptions.length > 0;

  // ── Subscriptions / MRR ──
  const activeSubs = subscriptions.filter((s) => s.properties.hs_subscription_status === "active");
  const canceledSubs = subscriptions.filter((s) =>
    ["canceled", "expired", "paused"].includes(s.properties.hs_subscription_status ?? ""),
  );
  // Calcul MRR : somme des amounts en convertissant selon billing frequency
  const mrr = activeSubs.reduce((sum, s) => {
    const amount = parseFloat(s.properties.hs_amount_total ?? "0");
    const freq = (s.properties.hs_billing_frequency ?? "monthly").toLowerCase();
    if (freq.includes("year") || freq.includes("annu")) return sum + amount / 12;
    if (freq.includes("quarter")) return sum + amount / 3;
    if (freq.includes("week")) return sum + amount * 4.33;
    return sum + amount; // monthly default
  }, 0);
  const arr = mrr * 12;

  const churnRate =
    subscriptions.length > 0 ? Math.round((canceledSubs.length / subscriptions.length) * 100) : null;

  // ── Invoices ──
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
  const avgInvoice =
    invoices.length > 0
      ? Math.round(
          invoices.reduce((s, i) => s + parseFloat(i.properties.hs_amount_billed ?? "0"), 0) /
            invoices.length,
        )
      : null;

  // ── Score ──
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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paiements, factures et revenus récurrents.
          {hasData && ` Source : HubSpot live (${invoices.length} factures, ${subscriptions.length} subscriptions)`}
        </p>
      </header>

      <PerformancesTabs />

      <InsightLockedBlock
        previewTitle={`Analyse IA paiements & facturation (score ${score}/100)`}
        previewBody="L'IA Revold détecte les risques de défaut de paiement, optimise le recouvrement et identifie les patterns de churn liés à la facturation."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Revenus récurrents
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MRR</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{mrr > 0 ? fmtK(mrr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Mensuel récurrent</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{arr > 0 ? fmtK(arr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Annualisé (MRR × 12)</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subscriptions actives</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(activeSubs.length)}</p>
            <p className="mt-1 text-xs text-slate-400">sur {fmt(subscriptions.length)}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de churn</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                churnRate != null && churnRate > 10
                  ? "text-red-500"
                  : churnRate != null && churnRate > 5
                  ? "text-orange-500"
                  : "text-emerald-600"
              }`}
            >
              {churnRate != null ? `${churnRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Annulés / total subs</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Facturation
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Factures émises</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(invoices.length)}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Montant moyen</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {avgInvoice != null && avgInvoice > 0 ? fmtK(avgInvoice) : "—"}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Impayées</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                unpaidInvoices.length > 5
                  ? "text-red-500"
                  : unpaidInvoices.length > 0
                  ? "text-orange-500"
                  : "text-emerald-600"
              }`}
            >
              {fmt(unpaidInvoices.length)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {totalUnpaidAmount > 0 ? fmtK(totalUnpaidAmount) : ""}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total encaissé</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {totalPaid > 0 ? fmtK(totalPaid) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(paidInvoices.length)} factures payées</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Pipeline revenue (HubSpot Deals)
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Pipeline ouvert</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {snapshot.totalPipelineAmount > 0 ? fmtK(snapshot.totalPipelineAmount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(snapshot.openDeals)} deals</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Won historique</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {snapshot.wonAmount > 0 ? fmtK(snapshot.wonAmount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(snapshot.wonDeals)} deals gagnés</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Devis émis</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.totalQuotes)}</p>
            <p className="mt-1 text-xs text-slate-400">HubSpot Quotes</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Line items</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.totalLineItems)}</p>
            <p className="mt-1 text-xs text-slate-400">SKUs vendus</p>
          </article>
        </div>
      </CollapsibleBlock>

      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture ni subscription dans HubSpot. Activez HubSpot Invoices/Payments
            ou connectez Stripe pour alimenter cette page automatiquement.
          </p>
        </div>
      )}
    </section>
  );
}
