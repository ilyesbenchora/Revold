export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { PipelineManagementCarousel } from "@/components/pipeline-management-carousel";
import { PipelineConversionBlock } from "@/components/pipeline-conversion-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { PageSections } from "@/components/data-tables/page-sections";
import { type PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";
import {
  buildPipelineConversion,
  type PipelineConversion,
} from "@/lib/integrations/hubspot-pipeline-conversion";
import { computePipelineAnalyticsFromLocal } from "@/lib/sync/compute-pipeline-analytics";
import { computeDealsSeries } from "@/lib/audit/deals-series";
import { fetchDealProductsData } from "@/lib/audit/deal-products-data";
import { TresoLineChart, SimpleBarsChart } from "@/components/charts/treso-charts";
import { HBarChart } from "@/components/charts/hbar-chart";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList, type HiddenBlockMeta } from "@/lib/kpi/page-tiles";

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();

  // Calcul des analytics directement depuis le miroir Supabase (deals +
  // snapshot.pipelines). Aucun appel HubSpot live → plus de "0 partout"
  // intermittent dû à un timeout/429.
  let pipelineAnalytics: PipelineAnalytics[] = [];
  let pipelineConversions: PipelineConversion[] = [];

  if (snapshot.pipelines.length > 0) {
    pipelineAnalytics = await computePipelineAnalyticsFromLocal(
      supabase,
      orgId,
      snapshot.pipelines,
    );
    pipelineConversions = pipelineAnalytics.map(buildPipelineConversion);
  }

  // KPIs + séries mensuelles depuis le miroir canonique (tuiles + graphes).
  const series = await computeDealsSeries(supabase, orgId);
  // Produits associés aux deals (line items) — axe d'analyse capital : équipement,
  // profondeur de panier, cross-sell réel.
  const products = await fetchDealProductsData(supabase, orgId);
  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "perf_ventes");
  const tiles: DefaultTile[] = series.hasData
    ? [
        { key: "ca_signe", label: "CA signé", value: eur(series.caSigneTotal), raw: series.caSigneTotal, rawUnit: "currency", tone: "pos", sub: "Deals gagnés · cumul" },
        { key: "pipeline_pondere", label: "Pipeline pondéré", value: eur(series.pipelinePondere), raw: series.pipelinePondere, rawUnit: "currency", tone: "accent", sub: "Deals ouverts × probabilité" },
        {
          key: "closing_rate",
          label: "Closing rate",
          value: series.closingRate != null ? `${series.closingRate} %` : "—",
          raw: series.closingRate,
          rawUnit: "percent",
          tone: series.closingRate == null ? "neutral" : series.closingRate >= 40 ? "pos" : series.closingRate >= 25 ? "accent" : "neg",
          sub: "Gagnés / clôturés",
          verdict: series.closingRate == null ? undefined
            : series.closingRate >= 40 ? { label: "Excellent (> 40 %)", tone: "pos" }
            : series.closingRate >= 25 ? { label: "Correct", tone: "warn" }
            : { label: "Faible (< 25 %)", tone: "neg" },
        },
        {
          key: "cycle_vente",
          label: "Cycle de vente moyen",
          value: series.cycleMoyenJours != null ? `${series.cycleMoyenJours} j` : "—",
          raw: series.cycleMoyenJours,
          rawUnit: "count",
          tone: "neutral",
          sub: "Création → closing (gagnés)",
          verdict: series.cycleMoyenJours == null ? undefined
            : series.cycleMoyenJours <= 30 ? { label: "Rapide", tone: "pos" }
            : series.cycleMoyenJours <= 90 ? { label: "Dans la norme", tone: "warn" }
            : { label: "Long (> 90 j)", tone: "neg" },
        },
        {
          key: "deals_multi_produits",
          label: "Deals multi-produits",
          value: products.multiProductPct != null ? `${products.multiProductPct} %` : "—",
          raw: products.multiProductPct,
          rawUnit: "percent",
          tone: products.multiProductPct == null ? "neutral" : products.multiProductPct >= 30 ? "pos" : products.multiProductPct >= 10 ? "accent" : "neg",
          sub: `${products.avgProductsPerDeal ?? "—"} produit(s) par deal équipé`,
          verdict: products.multiProductPct == null ? undefined
            : products.multiProductPct >= 30 ? { label: "Cross-sell installé", tone: "pos" }
            : products.multiProductPct >= 10 ? { label: "À développer", tone: "warn" }
            : { label: "Mono-produit dominant", tone: "neg" },
        },
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
          <p className="mt-1 text-sm text-slate-500">
            La vérité sur ta performance — ce qui progresse, ce qui décroche, où agir en premier.
          </p>
        </div>
      </header>

      <PerformancesTabs />
      <VentesTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance commerciale"
        previewBody="L'IA Revold identifie les deals à risque, les patterns de closing gagnants et les optimisations de pipeline à fort impact sur votre taux de conversion."
      />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_perf_ventes" categories={["crm"]}>

      {/* ── Lecture en un coup d'œil : tuiles KPI configurables (CTA unique :
             le panneau d'ajout contient aussi les blocs de la page) ── */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="perf_ventes"
        defaults={tiles}
        customization={custom}
        tablesPageKey="perf_ventes"
        hiddenBlocks={hiddenBlockList(custom, (key) => (({
          ca_charts: {
            view: "chart-line",
            description: "CA signé par mois + cumul — 2 graphiques",
            preview: { entity: "deals", groupBy: "month_closed", measure: "sum", field: "amount", unit: "currency", view: "line" },
          },
          pipeline_stages_bars: {
            view: "chart-bar",
            description: "Montant ouvert par étape, par pipeline",
            preview: { entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
          },
          pipeline_management: {
            view: "carousel",
            description: "Carrousel d'analyse par pipeline (volumes, montants, vélocité)",
            preview: { entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
          },
          pipeline_conversion: {
            view: "funnel",
            description: "Taux de conversion étape par étape",
            preview: { entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
          },
          produits_analyse: {
            view: "chart-bar",
            description: "Top produits par CA (line items) + équipement mono/multi-produit des deals",
            preview: { entity: "deals", groupBy: "has_products", measure: "count", unit: "count", view: "bar" },
          },
        } as Record<string, HiddenBlockMeta>)[key]))}
      />

      {/* ── Graphes : CA signé par mois + cumul ── */}
      {series.wonMonthly.length > 1 && !custom.hiddenBlocks.has("ca_charts") && (
        <RemovableBlock pageKey="perf_ventes" blockKey="ca_charts" label="Graphes CA signé">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-800">CA signé par mois</p>
              <p className="mb-2 text-[10px] text-slate-400">Deals gagnés · 12 derniers mois</p>
              <SimpleBarsChart points={series.wonMonthly} color="#10b981" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-800">Cumul du CA signé</p>
              <p className="mb-2 text-[10px] text-slate-400">Progression cumulée sur la période</p>
              <TresoLineChart points={series.wonCumul} />
            </div>
          </div>
        </RemovableBlock>
      )}

      {/* ── Analyse PRODUITS : top produits par CA + équipement des deals ── */}
      {(products.topProducts.length > 0 || products.dealsWithProducts > 0) && !custom.hiddenBlocks.has("produits_analyse") && (
        <RemovableBlock pageKey="perf_ventes" blockKey="produits_analyse" label="Analyse produits des deals">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {products.topProducts.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Top produits par CA</p>
                <p className="mb-3 text-[10px] text-slate-400">
                  Line items associés aux deals · {products.distinctProducts} produits distincts vendus
                </p>
                <HBarChart
                  unit="currency"
                  items={products.topProducts.map((p) => ({ label: `${p.name} (${p.count})`, value: p.amount }))}
                />
              </div>
            )}
            {products.dealsWithProducts > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Équipement produit des deals</p>
                <p className="mb-3 text-[10px] text-slate-400">
                  {products.avgProductsPerDeal ?? "—"} produit(s) par deal équipé · potentiel cross-sell sur les mono-produit
                </p>
                <HBarChart
                  unit="count"
                  items={[
                    { label: "Multi-produits (≥ 2)", value: products.multiProductDeals, color: "#10b981" },
                    { label: "Mono-produit", value: products.monoProductDeals, color: "#6366f1" },
                    { label: "Sans produit associé", value: Math.max(0, products.totalDeals - products.dealsWithProducts), color: "#94a3b8" },
                  ].filter((i) => i.value > 0)}
                />
              </div>
            )}
          </div>
        </RemovableBlock>
      )}

      {/* ── Répartition du pipeline par étape : barres horizontales cockpit ── */}
      {pipelineAnalytics.some((p) => p.totalDeals > 0) && !custom.hiddenBlocks.has("pipeline_stages_bars") && (
        <RemovableBlock pageKey="perf_ventes" blockKey="pipeline_stages_bars" label="Répartition du pipeline par étape">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pipelineAnalytics.filter((p) => p.totalDeals > 0).map((p) => (
              <div key={p.pipeline.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Pipeline par étape — {p.pipeline.label}</p>
                <p className="mb-3 text-[10px] text-slate-400">
                  Montant ouvert par étape · {p.totalDeals} deals · pondéré {eur(p.weightedAmount)}
                </p>
                <HBarChart
                  unit="currency"
                  items={p.stages
                    .filter((s) => s.dealCount > 0)
                    .map((s) => ({ label: `${s.stage.label} (${s.dealCount})`, value: Math.round(s.amount) }))}
                />
              </div>
            ))}
          </div>
        </RemovableBlock>
      )}

      {/* ── Pipeline revenue & devis — déménagé depuis Trésorerie → Facturation :
             KPIs 100 % CRM (pipeline ouvert, won, devis, line items), retirable. ── */}
      {!custom.hiddenBlocks.has("pipeline_devis") && snapshot.pipelines.length > 0 && (
        <RemovableBlock pageKey="perf_ventes" blockKey="pipeline_devis" label="Pipeline revenue & devis">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Pipeline revenue &amp; devis
              </h2>
            }
          >
            <BlockDataTable
              title="Pipeline revenue & devis"
              subtitle="deals · quotes · line items"
              team="sales"
              unit="currency"
              nameLabel="Indicateur"
              extraColumns={["Détail"]}
              rows={[
                { name: "Pipeline ouvert", value: snapshot.totalPipelineAmount > 0 ? snapshot.totalPipelineAmount : null, unit: "currency" as const, cells: [`${snapshot.openDeals.toLocaleString("fr-FR")} deals`], spec: { entity: "deals", groupBy: "status", measure: "sum" as const, field: "amount", target: "En cours" } },
                { name: "Won historique", value: snapshot.wonAmount > 0 ? snapshot.wonAmount : null, unit: "currency" as const, cells: [`${snapshot.wonDeals.toLocaleString("fr-FR")} deals gagnés`], spec: { entity: "deals", groupBy: "outcome", measure: "sum" as const, field: "amount", target: "Gagnés" } },
                { name: "Devis émis", value: snapshot.totalQuotes, unit: "count" as const, cells: ["HubSpot Quotes"] },
                { name: "Line items", value: snapshot.totalLineItems, unit: "count" as const, cells: ["SKUs vendus"] },
              ]}
              footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
            />
          </CollapsibleBlock>
        </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("pipeline_management") && (
        <RemovableBlock pageKey="perf_ventes" blockKey="pipeline_management" label="Pipeline Management">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Pipeline Management
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {pipelineAnalytics.length} pipeline{pipelineAnalytics.length > 1 ? "s" : ""}
                </span>
              </h2>
            }
          >
            <PipelineManagementCarousel pipelines={pipelineAnalytics} />
          </CollapsibleBlock>
        </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("pipeline_conversion") && (
        <RemovableBlock pageKey="perf_ventes" blockKey="pipeline_conversion" label="Taux de conversion pipeline">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Taux de conversion pipeline
              </h2>
            }
          >
            <PipelineConversionBlock conversions={pipelineConversions} />
          </CollapsibleBlock>
        </RemovableBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey="perf_ventes" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_perf_ventes" />

      <CreateAlertModal hideTrigger />

      <PageSections pageKey="perf_ventes" />
    </section>
  );
}
