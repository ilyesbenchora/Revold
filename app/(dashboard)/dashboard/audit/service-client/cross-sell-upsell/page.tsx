export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationFor, fmtK } from "@/lib/audit/paiement-facturation-data";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";

// Clé de personnalisation propre à la sous-page (tuiles masquées/renommées,
// KPIs ajoutés) — catalogue de KPIs service client hérité de la page parente.
const PAGE_KEY = "audit_service_client_cross_sell";
// Sources : réglage propre à la sous-page, héritage Vue d'ensemble sinon.
const SOURCE_KEYS = [PAGE_KEY, "audit_service_client"];

export default async function ServiceClientCrossSellUpsellPage() {
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

      {/* Blocs pilotés par « Outil source par page » (réglage propre à la
          sous-page, héritage Vue d'ensemble sinon) — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} categories={["crm", "support"]}>

      {/* Lecture cockpit en un coup d'œil, avant les blocs détaillés —
          tuiles configurables (CTA « Personnaliser les KPIs », ✎, masquage). */}
      {(() => {
        const tiles: DefaultTile[] = [
          {
            key: "arpu_mensuel",
            label: "ARPU mensuel",
            value: arpu != null ? fmtK(arpu) : "—",
            raw: arpu,
            rawUnit: "currency",
            tone: "accent",
            sub: "MRR / subs actives",
          },
          {
            key: "clients_sains",
            label: "Clients sains",
            value: healthyPct != null ? `${healthyPct} %` : "—",
            raw: healthyPct,
            rawUnit: "percent",
            tone: healthyPct == null ? "neutral" : healthyPct >= 70 ? "pos" : healthyPct >= 40 ? "accent" : "neg",
            sub: "Sans ticket ouvert — candidats expansion",
            verdict: healthyPct == null ? undefined
              : healthyPct >= 70 ? { label: "Terrain favorable", tone: "pos" }
              : healthyPct >= 40 ? { label: "Mitigé", tone: "warn" }
              : { label: "Support surchargé", tone: "neg" },
          },
          {
            key: "potentiel_expansion",
            label: "Potentiel d'expansion",
            value: expansionPotentialMrr != null ? `${fmtK(expansionPotentialMrr)}/mois` : "—",
            raw: expansionPotentialMrr,
            rawUnit: "currency",
            tone: "pos",
            sub: "Clients sains × ARPU × 20 %",
          },
          {
            key: "multi_produit",
            label: "Multi-produit",
            value: subsPerCustomer != null ? `${subsPerCustomer} subs/client` : "—",
            raw: subsPerCustomer,
            rawUnit: "count",
            tone: multiProductRate > 0 ? "pos" : "neutral",
            sub: multiProductRate > 0 ? `${multiProductRate} % d'équipement au-delà de 1` : "1 produit par client",
          },
        ];
        return <ConfigurableKpiTiles supabase={supabase} orgId={orgId} pageKey={PAGE_KEY} defaults={tiles} />;
      })()}

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Revenue par client (ARPU & LTV)
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Revenue par client (ARPU & LTV)"
          subtitle="ARPU / LTV"
          team="csm"
          unit="currency"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "ARPU mensuel", value: arpu, unit: "currency", cells: ["MRR / subs actives"] },
            { name: "ARPU annuel", value: arpuAnnual, unit: "currency", cells: ["ARPU × 12"] },
            {
              name: "LTV (estimée)",
              value:
                arpu != null && billing.churnRate != null && billing.churnRate > 0
                  ? Math.round((arpu * 12) / (billing.churnRate / 100))
                  : null,
              unit: "currency",
              cells: ["ARPU annuel / churn rate"],
            },
            { name: "Subs / customer", value: subsPerCustomer, unit: "count", cells: ["> 1 = clients multi-produit"] },
          ]}
          footnote="Unités hétérogènes (montants et ratio) : pas de total agrégé."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Potentiel d&apos;expansion
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Comptes &laquo; healthy &raquo; (sans ticket ouvert) = candidats expansion prioritaires :
          activation rapide, NPS positif probable, payment on track.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Potentiel d'expansion"
            subtitle="expansion"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Customers healthy", value: healthyCustomers, unit: "count", cells: ["Sans ticket ouvert"] },
              { name: "% du portefeuille healthy", value: healthyPct, unit: "percent", cells: [`${fmt(totalCustomers)} customers totaux`] },
              { name: "Customers totaux", value: totalCustomers, unit: "count", cells: ["—"] },
              { name: "Expansion MRR potentiel", value: expansionPotentialMrr, unit: "currency", cells: ["healthy × ARPU × 20% upsell"] },
              { name: "Multi-produit", value: multiProductRate, unit: "percent", cells: ["% subs additionnelles"] },
            ]}
            footnote="Unités hétérogènes (volumes, % et montants) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Pipeline expansion (deals ouverts sur customers)
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Pipeline expansion"
          subtitle="deals ouverts sur customers"
          team="sales"
          unit="count"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Deals ouverts", value: snapshot.openDeals, unit: "count", cells: ["Tous pipelines confondus"] },
            {
              name: "Pipeline ouvert €",
              value: snapshot.totalPipelineAmount > 0 ? snapshot.totalPipelineAmount : null,
              unit: "currency",
              cells: ["Inclut new business + expansion"],
            },
            {
              name: "Taux deals / customer",
              value: totalCustomers > 0 ? Math.round((snapshot.openDeals / totalCustomers) * 100) : null,
              unit: "percent",
              cells: ["% customers avec deal ouvert"],
            },
          ]}
          footnote="Unités hétérogènes (volume, montant et %) : pas de total agrégé."
        />
      </CollapsibleBlock>

      </PageSourcesGate>

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} />
    </section>
  );
}
