export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationFor } from "@/lib/audit/paiement-facturation-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

export default async function ServiceClientRenouvellementPage() {
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

  // ── KPIs renouvellement ──
  // Annual subs : celles dont la fréquence est annuelle (renouvellement plus rare mais critique)
  const annualSubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f.includes("year") || f.includes("annu");
  });
  const monthlySubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f === "" || f.includes("month") || f.includes("mens");
  });

  // Renewal rate proxy = % de subs actives parmi le total (incl. annulées)
  const renewalRate = billing.subscriptions.length > 0
    ? Math.round((billing.activeSubsCount / billing.subscriptions.length) * 100)
    : null;

  // GRR (Gross Revenue Retention) ≈ 100 - churn rate (sans tenir compte expansion)
  const grr = billing.churnRate != null ? Math.max(0, 100 - billing.churnRate) : null;

  // ARR sécurisé = subs actives × ARPU annuel
  const arpu = billing.activeSubsCount > 0 ? billing.mrr / billing.activeSubsCount : 0;
  const arrSecured = arpu * 12 * billing.activeSubsCount;

  // Risque renouvellement = subs avec problèmes santé (past_due, ticket urgent, etc.)
  const pastDueSubs = billing.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;
  const renewalAtRisk = pastDueSubs + scData.urgentTickets;
  const arrAtRisk = arpu * 12 * renewalAtRisk;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Renouvellement : taux de rétention, GRR, ARR sécurisé et exposition annuelle.
        </p>
      </header>

      <ServiceClientTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Taux de renouvellement & rétention
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Taux de renouvellement & rétention"
          subtitle="rétention"
          team="csm"
          unit="percent"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Renewal rate", value: renewalRate, unit: "percent", cells: ["Active / total subs"] },
            { name: "GRR", value: grr, unit: "percent", cells: ["Gross Revenue Retention"] },
            { name: "Churn rate", value: billing.churnRate ?? null, unit: "percent", cells: ["Cible top quartile : < 5%"] },
            { name: "Customers actifs", value: snapshot.customersCount, unit: "count", cells: ["Lifecycle = customer"] },
          ]}
          footnote="Unités hétérogènes (taux et volume) : pas de total agrégé."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Cohortes par fréquence
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Les subs annuelles ont un poids ARR plus élevé mais un cycle de renouvellement
          critique : 1 seule échéance par an, donc moins d&apos;opportunités de remédiation.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Cohortes par fréquence"
            subtitle="mix annuel / mensuel"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Subs annuelles", value: annualSubs.length, unit: "count", cells: ["Renewal critique 1× par an"] },
              { name: "Subs mensuelles", value: monthlySubs.length, unit: "count", cells: ["Renewal continu"] },
              {
                name: "% annuel dans le mix",
                value:
                  billing.subscriptions.length > 0
                    ? Math.round((annualSubs.length / billing.subscriptions.length) * 100)
                    : null,
                unit: "percent",
                cells: ["+ d'annuel = + de stabilité revenue"],
              },
            ]}
            footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            ARR sécurisé vs à risque
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="ARR sécurisé vs à risque"
          subtitle="ARR"
          team="csm"
          unit="currency"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "ARR sécurisé", value: arrSecured > 0 ? arrSecured : null, unit: "currency", cells: ["Subs actives healthy"] },
            { name: "ARR à risque", value: arrAtRisk > 0 ? arrAtRisk : null, unit: "currency", cells: ["Past due + tickets urgents"] },
            { name: "Subs à risque", value: renewalAtRisk, unit: "count", cells: ["À traiter en CSM proactif"] },
          ]}
          footnote="Unités hétérogènes (montants et volume) : pas de total agrégé."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Engagement pré-renouvellement
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Indicateurs d&apos;engagement à surveiller dans les 90 jours avant échéance :
          plus le compte est actif, plus la probabilité de renouvellement augmente.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Engagement pré-renouvellement"
            subtitle="engagement"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Conversations entrantes", value: snapshot.totalConversations, unit: "count", cells: ["Engagement Inbox"] },
              { name: "Tickets résolus < 24h (proxy CSAT)", value: scData.csatProxy ?? null, unit: "percent", cells: ["Proxy CSAT"] },
              { name: "Feedback collecté", value: snapshot.feedbackCount, unit: "count", cells: ["CSAT/NPS submissions"] },
            ]}
            footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>
    </section>
  );
}
