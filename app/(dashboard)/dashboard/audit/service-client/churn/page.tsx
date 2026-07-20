export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationFor } from "@/lib/audit/paiement-facturation-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

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
            Score de risque churn
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
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Score de risque churn"
            subtitle="risque churn"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Score de risque churn", value: riskScore, unit: "count", cells: ["sur 100"] },
              { name: "Taux de churn", value: churnRate ?? null, unit: "percent", cells: ["Cible top quartile : < 5%"] },
              { name: "Subs annulées", value: billing.canceledSubsCount, unit: "count", cells: ["canceled / expired / paused"] },
              { name: "Past due", value: pastDueSubs, unit: "count", cells: ["Paiements échoués (churn imminent)"] },
              { name: "NRR (proxy)", value: nrrProxy, unit: "percent", cells: ["Active / total subs"] },
            ]}
            footnote="Unités hétérogènes (score, %, volumes) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Signaux faibles à monitorer
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Signaux faibles à monitorer"
          subtitle="signaux faibles"
          team="csm"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Tickets urgents", value: scData.urgentTickets, unit: "count", cells: [`${urgencyRate}% du volume`] },
            { name: "% urgents du volume", value: urgencyRate, unit: "percent", cells: ["—"] },
            { name: "Tickets / contact", value: scData.ticketsPerCustomer ?? null, unit: "count", cells: ["> 3 = signal critique"] },
            { name: "Feedback collecté", value: snapshot.feedbackCount, unit: "count", cells: ["CSAT/NPS — 0 = angle mort"] },
          ]}
          footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Impact revenue du churn
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Impact revenue du churn"
          subtitle="impact revenue"
          team="csm"
          unit="currency"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            {
              name: "MRR perdu (estimé)",
              value:
                billing.activeSubsCount > 0 && billing.canceledSubsCount > 0
                  ? Math.round((billing.mrr / billing.activeSubsCount) * billing.canceledSubsCount)
                  : null,
              unit: "currency",
              cells: ["ARPU × subs annulées"],
            },
            {
              name: "ARR à risque (past due)",
              value:
                pastDueSubs > 0 && billing.activeSubsCount > 0
                  ? Math.round((billing.arr / billing.activeSubsCount) * pastDueSubs)
                  : null,
              unit: "currency",
              cells: ["ARPU annualisé × past due"],
            },
            {
              name: "MRR sain restant",
              value: billing.mrr > 0 ? billing.mrr : null,
              unit: "currency",
              cells: [`${fmt(billing.activeSubsCount)} subs actives`],
            },
            { name: "Subs actives", value: billing.activeSubsCount, unit: "count", cells: ["—"] },
          ]}
          footnote="Unités hétérogènes (montants et volumes) : pas de total agrégé."
        />
      </CollapsibleBlock>
    </section>
  );
}
