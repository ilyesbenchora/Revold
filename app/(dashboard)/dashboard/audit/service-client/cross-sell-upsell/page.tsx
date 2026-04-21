export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationData, fmtK } from "@/lib/audit/paiement-facturation-data";

export default async function ServiceClientCrossSellUpsellPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [scData, billing, snapshot] = await Promise.all([
    fetchServiceClientData(token),
    fetchPaiementFacturationData(token),
    getHubspotSnapshot(),
  ]);

  // KPIs cross-sell / upsell
  // ARPU = MRR / active subs (revenu moyen par utilisateur)
  const arpu = billing.activeSubsCount > 0 ? Math.round(billing.mrr / billing.activeSubsCount) : null;
  // ARPU annualisé
  const arpuAnnual = arpu != null ? arpu * 12 : null;
  // Customers totaux pour potentiel d'expansion
  const totalCustomers = snapshot.customersCount;
  // Healthy customers = clients sans tickets ouverts (proxy candidats expansion)
  const distinctTicketContacts = scData.distinctContactsCount;
  const healthyCustomers = Math.max(0, totalCustomers - distinctTicketContacts);
  const healthyPct = totalCustomers > 0
    ? Math.round((healthyCustomers / totalCustomers) * 100)
    : null;

  // Expansion potential = healthy customers × ARPU mensuel × 0.2 (hypothèse 20% d'upsell)
  const expansionPotentialMrr = arpu != null && healthyCustomers > 0
    ? Math.round(healthyCustomers * arpu * 0.2)
    : null;

  // Multi-product : si on a des subscriptions > customers, ça veut dire que certains clients ont 2+ subs
  const subsPerCustomer = totalCustomers > 0
    ? Math.round((billing.subscriptions.length / totalCustomers) * 100) / 100
    : null;
  const multiProductRate = subsPerCustomer != null && subsPerCustomer > 1
    ? Math.round((subsPerCustomer - 1) * 100)
    : 0;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-sell &amp; upsell : ARPU, potentiel d&apos;expansion et multi-produit.
        </p>
      </header>

      <ServiceClientTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Revenue par client (ARPU & LTV)
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARPU mensuel</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{arpu != null ? fmtK(arpu) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">MRR / subs actives</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARPU annuel</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{arpuAnnual != null ? fmtK(arpuAnnual) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">ARPU × 12</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">LTV (estimée)</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {arpu != null && billing.churnRate != null && billing.churnRate > 0
                ? fmtK(Math.round((arpu * 12) / (billing.churnRate / 100)))
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">ARPU annuel / churn rate</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subs / customer</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {subsPerCustomer != null ? subsPerCustomer.toFixed(2) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">&gt; 1 = clients multi-produit</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Potentiel d&apos;expansion
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Comptes &laquo; healthy &raquo; (sans ticket ouvert) = candidats expansion prioritaires :
          activation rapide, NPS positif probable, payment on track.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Customers healthy</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{fmt(healthyCustomers)}</p>
            <p className="mt-1 text-xs text-slate-400">Sans ticket ouvert</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">% du portefeuille healthy</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                healthyPct != null && healthyPct >= 70 ? "text-emerald-600" : healthyPct != null && healthyPct >= 50 ? "text-amber-500" : "text-red-500"
              }`}
            >
              {healthyPct != null ? `${healthyPct}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(totalCustomers)} customers totaux</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Expansion MRR potentiel</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {expansionPotentialMrr != null ? fmtK(expansionPotentialMrr) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">healthy × ARPU × 20% upsell</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Multi-produit</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                multiProductRate >= 30 ? "text-emerald-600" : multiProductRate > 0 ? "text-amber-500" : "text-red-500"
              }`}
            >
              {multiProductRate}%
            </p>
            <p className="mt-1 text-xs text-slate-400">% subs additionnelles</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Pipeline expansion (deals ouverts sur customers)
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals ouverts</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.openDeals)}</p>
            <p className="mt-1 text-xs text-slate-400">Tous pipelines confondus</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Pipeline ouvert €</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {snapshot.totalPipelineAmount > 0 ? fmtK(snapshot.totalPipelineAmount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Inclut new business + expansion</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux deals/customer</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {totalCustomers > 0 ? `${Math.round((snapshot.openDeals / totalCustomers) * 100)}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">% customers avec deal ouvert</p>
          </article>
        </div>
      </CollapsibleBlock>
    </section>
  );
}
