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
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { type PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";
import {
  buildPipelineConversion,
  type PipelineConversion,
} from "@/lib/integrations/hubspot-pipeline-conversion";
import { computePipelineAnalyticsFromLocal } from "@/lib/sync/compute-pipeline-analytics";

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

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance commerciale"
        previewBody="L'IA Revold identifie les deals à risque, les patterns de closing gagnants et les optimisations de pipeline à fort impact sur votre taux de conversion."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="kanban" tone="blue" />
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
            <BlockHeaderIcon icon="funnel" tone="fuchsia" />
            Taux de conversion pipeline
          </h2>
        }
      >
        <PipelineConversionBlock conversions={pipelineConversions} />
      </CollapsibleBlock>

      <CreateAlertModal hideTrigger />
    </section>
  );
}
