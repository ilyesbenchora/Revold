export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { fetchPaiementFacturationFor, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

export default async function FacturationPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [data, snapshot] = await Promise.all([
    fetchPaiementFacturationFor(supabase, orgId, token),
    getHubspotSnapshot(),
  ]);

  // Audit factures > 30 jours impayées (DSO élevé)
  const now = Date.now();
  const overdueInvoices = data.invoices.filter((i) => {
    if (!["open", "uncollectible"].includes(i.properties.hs_invoice_status ?? "")) return false;
    const dueStr = i.properties.hs_due_date;
    if (!dueStr) return false;
    const due = parseInt(dueStr, 10);
    return !isNaN(due) && now - due > 30 * 86_400_000;
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paiement & Facturation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Détail facturation : émission, recouvrement, encaissement, devis et lignes vendues.
        </p>
      </header>

      <PaiementFacturationTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Émission & encaissement
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Factures émises</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(data.invoices.length)}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Montant moyen</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {data.avgInvoice != null && data.avgInvoice > 0 ? fmtK(data.avgInvoice) : "—"}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Impayées</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.unpaidInvoicesCount > 5
                  ? "text-red-500"
                  : data.unpaidInvoicesCount > 0
                  ? "text-orange-500"
                  : "text-emerald-600"
              }`}
            >
              {fmt(data.unpaidInvoicesCount)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : ""}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total encaissé</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {data.totalPaid > 0 ? fmtK(data.totalPaid) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(data.paidInvoicesCount)} factures payées</p>
          </article>
        </div>

        {/* Mêmes KPI que les tuiles ci-dessus, en table normalisée + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Émission & encaissement"
            subtitle="invoices"
            team="finance"
            unit="currency"
            nameLabel="Indicateur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Factures émises", value: data.invoices.length, unit: "count", cells: ["—"] },
              { name: "Montant moyen", value: data.avgInvoice != null && data.avgInvoice > 0 ? data.avgInvoice : null, unit: "currency", cells: ["Par facture émise"] },
              { name: "Factures impayées", value: data.unpaidInvoicesCount, unit: "count", cells: [data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"] },
              { name: "Total encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency", cells: [`${fmt(data.paidInvoicesCount)} factures payées`] },
            ]}
            footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
          />
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Recouvrement & DSO
            {overdueInvoices.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {overdueInvoices.length} en retard
              </span>
            )}
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Factures &gt; 30j impayées</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                overdueInvoices.length > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {fmt(overdueInvoices.length)}
            </p>
            <p className="mt-1 text-xs text-slate-400">DSO élevé = trésorerie à risque</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de paiement</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {data.invoices.length > 0
                ? `${Math.round((data.paidInvoicesCount / data.invoices.length) * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Payées / émises</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Encours total</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.totalUnpaidAmount > 0 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Cash à collecter</p>
          </article>
        </div>

        {/* Mêmes KPI que les tuiles ci-dessus, en table normalisée + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Recouvrement & DSO"
            subtitle="invoices"
            team="finance"
            unit="count"
            nameLabel="Indicateur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Factures > 30j impayées", value: overdueInvoices.length, unit: "count", cells: ["DSO élevé = trésorerie à risque"] },
              {
                name: "Taux de paiement",
                value: data.invoices.length > 0 ? Math.round((data.paidInvoicesCount / data.invoices.length) * 100) : null,
                unit: "percent",
                cells: ["Payées / émises"],
              },
              { name: "Encours total", value: data.totalUnpaidAmount > 0 ? data.totalUnpaidAmount : null, unit: "currency", cells: ["Cash à collecter"] },
            ]}
            footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
          />
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Pipeline revenue & devis
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

        {/* Mêmes KPI que les tuiles ci-dessus, en table normalisée + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Pipeline revenue & devis"
            subtitle="deals · quotes · line items"
            team="finance"
            unit="currency"
            nameLabel="Indicateur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Pipeline ouvert", value: snapshot.totalPipelineAmount > 0 ? snapshot.totalPipelineAmount : null, unit: "currency", cells: [`${fmt(snapshot.openDeals)} deals`] },
              { name: "Won historique", value: snapshot.wonAmount > 0 ? snapshot.wonAmount : null, unit: "currency", cells: [`${fmt(snapshot.wonDeals)} deals gagnés`] },
              { name: "Devis émis", value: snapshot.totalQuotes, unit: "count", cells: ["HubSpot Quotes"] },
              { name: "Line items", value: snapshot.totalLineItems, unit: "count", cells: ["SKUs vendus"] },
            ]}
            footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
          />
        </div>
      </CollapsibleBlock>

      {!data.hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture dans HubSpot. Activez HubSpot Invoices ou connectez un outil de
            facturation (Stripe, Pennylane) dans Intégrations pour alimenter cette page.
          </p>
        </div>
      )}
    </section>
  );
}
