export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { DealsAtRiskBlock } from "@/components/deals-at-risk-block";
import { fetchDealRiskBuckets } from "@/lib/integrations/hubspot-deal-risk";

export default async function DealsARisquePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const pipelines = snapshot.pipelines.map((p) => ({
    id: p.id,
    label: p.label,
    stages: p.stages.map((s) => ({ id: s.id, label: s.label })),
  }));

  const initialPipelineId = pipelines[0]?.id ?? "";
  const initialBuckets =
    token && initialPipelineId
      ? await fetchDealRiskBuckets(token, initialPipelineId).catch(() => ({
          pipelineId: initialPipelineId,
          blocked: [],
          noVisibility: [],
          noActivity: [],
        }))
      : { pipelineId: initialPipelineId, blocked: [], noVisibility: [], noActivity: [] };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Deals à risque</h1>
        <p className="mt-1 text-sm text-slate-500">
          Identifie les deals bloqués, sans visibilité ou sans activités sur le pipeline sélectionné.
        </p>
      </header>

      <PerformancesTabs />
      <VentesTabs />

      {pipelines.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun pipeline détecté. Vérifiez la connexion HubSpot.
        </p>
      ) : (
        <DealsAtRiskBlock
          pipelines={pipelines}
          initialPipelineId={initialPipelineId}
          initialBuckets={initialBuckets}
        />
      )}
    </section>
  );
}
