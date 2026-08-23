export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchDealProductsData } from "@/lib/audit/deal-products-data";
import { fmtK } from "@/lib/audit/paiement-facturation-data";
import { fmt } from "@/lib/audit/service-client-data";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";
import { HBarChart } from "@/components/charts/hbar-chart";

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
  const [products, snapshot, custom] = await Promise.all([
    fetchDealProductsData(supabase, orgId),
    getHubspotSnapshot(),
    getPageCustomization(supabase, orgId, PAGE_KEY),
  ]);

  // ── KPIs cross-sell / upsell INDEXÉS SUR LES PRODUITS DES DEALS ──
  // (line items HubSpot associés aux deals — pas sur les abonnements : c'est
  // là que se lit le multi-produit réel quand l'outil connecté est HubSpot)
  const totalCustomers = snapshot.customersCount;

  // Potentiel d'expansion = deals gagnés MONO-produit × panier moyen × 20 %
  // (hypothèse : 1 deal mono-produit sur 5 peut être équipé d'un produit de plus)
  const expansionPotential = products.avgWonAmount != null && products.monoProductDeals > 0
    ? Math.round(products.monoProductDeals * products.avgWonAmount * 0.2)
    : null;

  const recurringPct = products.lineItemsTotal > 0
    ? Math.round((products.recurringLineItems / products.lineItemsTotal) * 100)
    : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-sell &amp; upsell : équipement produit des deals, panier moyen et potentiel d&apos;expansion.
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
            key: "panier_moyen",
            label: "Panier moyen (gagnés)",
            value: products.avgWonAmount != null ? fmtK(products.avgWonAmount) : "—",
            raw: products.avgWonAmount,
            rawUnit: "currency",
            tone: "accent",
            sub: `${fmt(products.wonDeals)} deals gagnés`,
          },
          {
            key: "produits_par_deal",
            label: "Produits par deal",
            value: products.avgProductsPerDeal != null ? String(products.avgProductsPerDeal) : "—",
            raw: products.avgProductsPerDeal,
            rawUnit: "count",
            tone: products.avgProductsPerDeal != null && products.avgProductsPerDeal > 1 ? "pos" : "neutral",
            sub: `${fmt(products.dealsWithProducts)} deals avec produits associés`,
          },
          {
            key: "deals_multi_produits",
            label: "Deals multi-produits",
            value: products.multiProductPct != null ? `${products.multiProductPct} %` : "—",
            raw: products.multiProductPct,
            rawUnit: "percent",
            tone: products.multiProductPct == null ? "neutral" : products.multiProductPct >= 30 ? "pos" : products.multiProductPct >= 10 ? "accent" : "neg",
            sub: "≥ 2 produits associés au deal",
            verdict: products.multiProductPct == null ? undefined
              : products.multiProductPct >= 30 ? { label: "Bon équipement", tone: "pos" }
              : products.multiProductPct >= 10 ? { label: "À développer", tone: "warn" }
              : { label: "Mono-produit dominant", tone: "neg" },
          },
          {
            key: "potentiel_expansion",
            label: "Potentiel d'expansion",
            value: expansionPotential != null ? fmtK(expansionPotential) : "—",
            raw: expansionPotential,
            rawUnit: "currency",
            tone: "pos",
            sub: `${fmt(products.monoProductDeals)} deals mono-produit × panier × 20 %`,
          },
        ];
        return (
          <ConfigurableKpiTiles
            supabase={supabase}
            orgId={orgId}
            pageKey={PAGE_KEY}
            defaults={tiles}
            customization={custom}
            tablesPageKey={PAGE_KEY}
            hiddenBlocks={hiddenBlockList(custom, (key) => {
              const m = ({
                revenue_produits: { view: "table", description: "CA par produit vendu (line items) : top produits, catalogue, part récurrente" },
                equipement_deals: { view: "table", description: "Équipement produit des deals : mono vs multi, produits par deal" },
                pipeline_expansion: { view: "table", description: "Deals ouverts sur customers, pipeline € et taux d'équipement" },
              } as Record<string, { view: string; description: string }>)[key];
              const c = blockPreviewMeta(key);
              return m ? { ...m, preview: c?.preview } : c;
            })}
          />
        );
      })()}

      {!custom.hiddenBlocks.has("revenue_produits") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="revenue_produits" label="Revenue par produit">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Revenue par produit (line items des deals)
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Revenue par produit"
          subtitle="produits vendus"
          team="csm"
          unit="currency"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "CA signé (deals gagnés)", value: products.wonAmount > 0 ? products.wonAmount : null, unit: "currency", cells: [`${fmt(products.wonDeals)} deals gagnés`], spec: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: "Gagnés" } },
            { name: "Panier moyen", value: products.avgWonAmount, unit: "currency", cells: ["CA signé / deals gagnés"], spec: { entity: "deals", groupBy: "outcome", measure: "avg", field: "amount", target: "Gagnés" } },
            { name: "Produits distincts vendus", value: products.distinctProducts, unit: "count", cells: ["Catalogue réellement vendu"] },
            { name: "Lignes produit (line items)", value: products.lineItemsTotal, unit: "count", cells: ["Produits associés aux deals"] },
            { name: "Part récurrente", value: recurringPct, unit: "percent", cells: ["Line items avec fréquence de facturation"] },
          ]}
          footnote="Source : line items HubSpot associés aux deals. Unités hétérogènes : pas de total agrégé."
        />

        {products.topProducts.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-800">Top produits par CA</p>
            <p className="mb-3 text-[10px] text-slate-400">Montant cumulé des line items · {fmt(products.distinctProducts)} produits distincts</p>
            <HBarChart
              unit="currency"
              items={products.topProducts.map((p) => ({ label: `${p.name} (${p.count})`, value: p.amount }))}
            />
          </div>
        )}
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("equipement_deals") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="equipement_deals" label="Équipement produit des deals">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Équipement produit des deals
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Le multi-produit se lit sur les line items associés aux deals : un deal
          mono-produit est un candidat naturel au cross-sell, un deal multi-produits
          valide le motion d&apos;expansion.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Équipement produit des deals"
            subtitle="mono vs multi-produit"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Deals avec produits associés", value: products.dealsWithProducts, unit: "count", cells: ["hs_num_of_associated_line_items > 0"], spec: { entity: "deals", groupBy: "has_products", measure: "count", target: "Avec produits" } },
              { name: "Deals mono-produit", value: products.monoProductDeals, unit: "count", cells: ["Candidats cross-sell prioritaires"], spec: { entity: "deals", groupBy: "equipement", measure: "count", target: "Mono-produit" } },
              { name: "Deals multi-produits", value: products.multiProductDeals, unit: "count", tone: "pos", cells: ["≥ 2 produits associés"], spec: { entity: "deals", groupBy: "equipement", measure: "count", target: "Multi-produits (≥ 2)" } },
              { name: "% multi-produits", value: products.multiProductPct, unit: "percent", cells: ["Taux d'équipement au-delà de 1"] },
              { name: "Produits par deal (moy.)", value: products.avgProductsPerDeal, unit: "count", cells: ["Sur les deals avec produits"], spec: { entity: "deals", groupBy: "has_products", measure: "avg", field: "products", target: "Avec produits" } },
              { name: "Potentiel d'expansion", value: expansionPotential, unit: "currency", cells: ["Mono-produit × panier moyen × 20 %"] },
            ]}
            footnote="Unités hétérogènes (volumes, % et montants) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("pipeline_expansion") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="pipeline_expansion" label="Pipeline expansion">
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
            { name: "Deals ouverts", value: snapshot.openDeals, unit: "count", cells: ["Tous pipelines confondus"], spec: { entity: "deals", groupBy: "status", measure: "count", target: "En cours" } },
            {
              name: "Pipeline ouvert €",
              value: snapshot.totalPipelineAmount > 0 ? snapshot.totalPipelineAmount : null,
              unit: "currency",
              cells: ["Inclut new business + expansion"],
              spec: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: "En cours" },
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
      </RemovableBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey={PAGE_KEY} />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} />
    </section>
  );
}
