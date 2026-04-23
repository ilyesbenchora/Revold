export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { PipelineManagementCarousel } from "@/components/pipeline-management-carousel";
import { PipelineConversionBlock } from "@/components/pipeline-conversion-block";
import { ToolSourceMount } from "@/components/tool-source-mount";
import { CreateAlertModal } from "@/components/create-alert-modal";
import {
  fetchPipelineDataAtomic,
  buildPipelineAnalytics,
  type HsPipeline,
  type PipelineAnalytics,
} from "@/lib/integrations/hubspot-pipelines";
import {
  buildPipelineConversion,
  type PipelineConversion,
} from "@/lib/integrations/hubspot-pipeline-conversion";

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  let pipelineAnalytics: PipelineAnalytics[] = [];
  let pipelineConversions: PipelineConversion[] = [];
  let hsPipelines: HsPipeline[] = [];

  if (token) {
    hsPipelines = snapshot.pipelines.map((p) => ({
      id: p.id,
      label: p.label,
      stages: p.stages.map((s) => ({
        id: s.id,
        label: s.label,
        displayOrder: s.displayOrder,
        probability: s.probability * 100,
      })),
    }));

    const pipelineDataList = await Promise.all(
      hsPipelines.map((p) =>
        fetchPipelineDataAtomic(token, p).catch(() => ({
          pipeline: p,
          openDeals: [],
          wonCount: 0,
          lostCount: 0,
        })),
      ),
    );

    const allOpenDeals = pipelineDataList.flatMap((p) => p.openDeals);
    const closedByPipeline = {
      won: Object.fromEntries(pipelineDataList.map((p) => [p.pipeline.id, p.wonCount])),
      lost: Object.fromEntries(pipelineDataList.map((p) => [p.pipeline.id, p.lostCount])),
    };
    pipelineAnalytics = buildPipelineAnalytics(hsPipelines, allOpenDeals, closedByPipeline);
    pipelineConversions = pipelineAnalytics.map(buildPipelineConversion);
  }

  const total = snapshot.totalDeals;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pipeline et activité commerciale — source HubSpot live
          {total > 0 && ` (${total} deals analysés)`}
        </p>
      </header>

      <PerformancesTabs />
      <VentesTabs />

      <ToolSourceMount
        pageKey="audit_perf_ventes"
        pageLabel="Performances — Ventes"
        preferredCategories={["crm"]}
      />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance commerciale"
        previewBody="L'IA Revold identifie les deals à risque, les patterns de closing gagnants et les optimisations de pipeline à fort impact sur votre taux de conversion."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Pipeline Management
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
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Taux de conversion pipeline
          </h2>
        }
      >
        <PipelineConversionBlock conversions={pipelineConversions} />
      </CollapsibleBlock>

      <CreateAlertModal hideTrigger />
    </section>
  );
}
