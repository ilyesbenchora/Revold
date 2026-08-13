export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { PipelineManagementCarousel } from "@/components/pipeline-management-carousel";
import { PipelineConversionBlock } from "@/components/pipeline-conversion-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { type PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";
import {
  buildPipelineConversion,
  type PipelineConversion,
} from "@/lib/integrations/hubspot-pipeline-conversion";
import { computePipelineAnalyticsFromLocal } from "@/lib/sync/compute-pipeline-analytics";
import { computeDealsSeries } from "@/lib/audit/deals-series";
import { TresoLineChart, SimpleBarsChart } from "@/components/charts/treso-charts";
import { HBarChart } from "@/components/charts/hbar-chart";
import { PageSourcesGate } from "@/components/page-sources-gate";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { BlocksManager } from "@/components/data-tables/blocks-manager";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";

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

  const total = snapshot.totalDeals;

  // KPIs + séries mensuelles depuis le miroir canonique (tuiles + graphes).
  const series = await computeDealsSeries(supabase, orgId);
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
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pipeline et activité commerciale — source HubSpot live
            {total > 0 && ` (${total} deals analysés)`}
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

      {/* ── Lecture en un coup d'œil : tuiles KPI configurables ── */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="perf_ventes"
        defaults={tiles}
        customization={custom}
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

      {/* Ajouter un bloc : liste unifiée — blocs de la page retirés (visualisation
          d'origine) + presets avec aperçu réel. */}
      <BlocksManager
        pageKey="perf_ventes"
        tablesPageKey="perf_ventes"
        hiddenBlocks={hiddenBlockList(custom, (key) => ({
          ca_charts: { view: "chart-line", description: "CA signé par mois + cumul — 2 graphiques" },
          pipeline_stages_bars: { view: "chart-bar", description: "Montant ouvert par étape, par pipeline" },
          pipeline_management: { view: "carousel", description: "Carrousel d'analyse par pipeline (volumes, montants, vélocité)" },
          pipeline_conversion: { view: "funnel", description: "Taux de conversion étape par étape" },
        }[key]))}
      />

      </PageSourcesGate>

      <PageDataTables pageKey="perf_ventes" />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
