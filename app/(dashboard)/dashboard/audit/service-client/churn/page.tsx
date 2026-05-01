export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationFor, fmtK } from "@/lib/audit/paiement-facturation-data";

export default async function ServiceClientChurnPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [scData, billing, snapshot] = await Promise.all([
    fetchServiceClientData(token),
    fetchPaiementFacturationFor(supabase, orgId, token),
    getHubspotSnapshot(),
  ]);

  // ── Signaux churn ──
  // 1. Subscriptions annulées (proxy direct)
  const churnRate = billing.churnRate; // % canceled / total
  // 2. Past due (paiement échoué = signal fort de churn imminent)
  const pastDueSubs = billing.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;
  // 3. Tickets urgents = stress signal
  const urgencyRate = scData.tickets.length > 0
    ? Math.round((scData.urgentTickets / scData.tickets.length) * 100)
    : 0;
  // 4. Tickets / contact > 3 = client en difficulté
  const heavyUsers = scData.ticketsPerCustomer != null && scData.ticketsPerCustomer > 3;
  // 5. Net Revenue Retention proxy (très simplifié) :
  //    NRR ≈ (active subs / total subs) × 100, idéal > 100%
  const nrrProxy = billing.subscriptions.length > 0
    ? Math.round((billing.activeSubsCount / billing.subscriptions.length) * 100)
    : null;

  // Score de risque churn agrégé (0-100, plus c'est haut plus c'est risqué)
  const riskScore = Math.min(100, Math.round(
    (churnRate ?? 0) * 3 +
    (pastDueSubs > 0 ? 20 : 0) +
    (urgencyRate * 0.5) +
    (heavyUsers ? 15 : 0),
  ));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit churn : signaux faibles, customers à risque et impact revenue.
        </p>
      </header>

      <ServiceClientTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="alert-triangle" tone="rose" />Score de risque churn
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                riskScore >= 60 ? "bg-rose-100 text-rose-700" : riskScore >= 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {riskScore}/100
            </span>
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Score consolidé combinant churn rate, past due, urgence tickets et charge tickets/contact.
          Plus le score est élevé, plus le portefeuille est exposé.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de churn</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                churnRate != null && churnRate > 10 ? "text-red-500" : churnRate != null && churnRate > 5 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {churnRate != null ? `${churnRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Cible top quartile : &lt; 5%</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subs annulées</p>
            <p className="mt-1 text-3xl font-bold text-rose-600">{fmt(billing.canceledSubsCount)}</p>
            <p className="mt-1 text-xs text-slate-400">canceled / expired / paused</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Past due</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                pastDueSubs > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {fmt(pastDueSubs)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Paiements échoués (churn imminent)</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">NRR (proxy)</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                nrrProxy != null && nrrProxy >= 95 ? "text-emerald-600" : nrrProxy != null && nrrProxy >= 80 ? "text-amber-500" : "text-red-500"
              }`}
            >
              {nrrProxy != null ? `${nrrProxy}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Active / total subs</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="eye-off" tone="amber" />Signaux faibles à monitorer
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets urgents</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                urgencyRate > 20 ? "text-red-500" : urgencyRate > 10 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {fmt(scData.urgentTickets)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{urgencyRate}% du volume</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets / contact</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                heavyUsers ? "text-red-500" : "text-slate-900"
              }`}
            >
              {scData.ticketsPerCustomer != null ? scData.ticketsPerCustomer.toFixed(1) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">&gt; 3 = signal critique</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Feedback collecté</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                snapshot.feedbackCount === 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {fmt(snapshot.feedbackCount)}
            </p>
            <p className="mt-1 text-xs text-slate-400">CSAT/NPS — 0 = angle mort</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="log-out" tone="rose" />Impact revenue du churn
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MRR perdu (estimé)</p>
            <p className="mt-1 text-3xl font-bold text-rose-600">
              {billing.activeSubsCount > 0 && billing.canceledSubsCount > 0
                ? fmtK(Math.round((billing.mrr / billing.activeSubsCount) * billing.canceledSubsCount))
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">ARPU × subs annulées</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR à risque (past due)</p>
            <p className="mt-1 text-3xl font-bold text-orange-600">
              {pastDueSubs > 0 && billing.activeSubsCount > 0
                ? fmtK(Math.round((billing.arr / billing.activeSubsCount) * pastDueSubs))
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">ARPU annualisé × past due</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MRR sain restant</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{billing.mrr > 0 ? fmtK(billing.mrr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{fmt(billing.activeSubsCount)} subs actives</p>
          </article>
        </div>
      </CollapsibleBlock>
    </section>
  );
}
