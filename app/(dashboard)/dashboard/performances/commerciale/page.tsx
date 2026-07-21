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
import { CreateDataTableButton } from "@/components/data-tables/create-data-table-button";
import { type PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";
import {
  buildPipelineConversion,
  type PipelineConversion,
} from "@/lib/integrations/hubspot-pipeline-conversion";
import { computePipelineAnalyticsFromLocal } from "@/lib/sync/compute-pipeline-analytics";
import { computeDealsSeries } from "@/lib/audit/deals-series";
import { KpiStatTiles, type StatTile } from "@/components/kpi-stat-tiles";
import { TresoLineChart, SimpleBarsChart } from "@/components/charts/treso-charts";

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
  const tiles: StatTile[] = series.hasData
    ? [
        { label: "CA signé", value: eur(series.caSigneTotal), tone: "pos", sub: "Deals gagnés · cumul" },
        { label: "Pipeline pondéré", value: eur(series.pipelinePondere), tone: "accent", sub: "Deals ouverts × probabilité" },
        {
          label: "Closing rate",
          value: series.closingRate != null ? `${series.closingRate} %` : "—",
          tone: series.closingRate == null ? "neutral" : series.closingRate >= 40 ? "pos" : series.closingRate >= 25 ? "accent" : "neg",
          sub: "Gagnés / clôturés",
          verdict: series.closingRate == null ? undefined
            : series.closingRate >= 40 ? { label: "Excellent (> 40 %)", tone: "pos" }
            : series.closingRate >= 25 ? { label: "Correct", tone: "warn" }
            : { label: "Faible (< 25 %)", tone: "neg" },
        },
        {
          label: "Cycle de vente moyen",
          value: series.cycleMoyenJours != null ? `${series.cycleMoyenJours} j` : "—",
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
        <CreateDataTableButton />
      </header>

      <PerformancesTabs />
      <VentesTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance commerciale"
        previewBody="L'IA Revold identifie les deals à risque, les patterns de closing gagnants et les optimisations de pipeline à fort impact sur votre taux de conversion."
      />

      {/* ── Lecture en un coup d'œil : tuiles KPI colorées ── */}
      {tiles.length > 0 && <KpiStatTiles tiles={tiles} />}

      {/* ── Graphes : CA signé par mois + cumul ── */}
      {series.wonMonthly.length > 1 && (
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
      )}

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

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Taux de conversion pipeline
          </h2>
        }
      >
        <PipelineConversionBlock conversions={pipelineConversions} />
      </CollapsibleBlock>

      <PageDataTables pageKey="perf_ventes" />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
