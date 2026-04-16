import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CoachingTabs } from "@/components/coaching-tabs";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import {
  buildContext,
  fetchDismissals,
  fetchIntegrationInsights,
  fetchCrossSourceInsights,
  fetchDataModelInsights,
  fetchTrackingStats,
  selectInsights,
} from "./context";

export default async function CoachingLayout({ children }: { children: ReactNode }) {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys, doneCount, removedCount }, { detectedIntegrations, integrationInsights }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
  ]);

  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys);
  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  const totalActive =
    insightsByCategory.commercial.length +
    insightsByCategory.marketing.length +
    insightsByCategory.data.length +
    visibleIntegrationInsights.length +
    crossSourceInsights.length +
    dataModelInsights.length;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Coaching IA</h1>
          <p className="mt-1 text-sm text-slate-500">Analyses, recommandations et coaching par catégorie.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">
            {totalActive} actif{totalActive > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {doneCount} réalisé{doneCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
            {removedCount} retiré{removedCount > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <CoachingTabs
        counts={{
          commercial: insightsByCategory.commercial.length,
          marketing: insightsByCategory.marketing.length,
          data: insightsByCategory.data.length,
          integration: visibleIntegrationInsights.length,
          crossSource: crossSourceInsights.length,
          dataModel: dataModelInsights.length,
        }}
      />

      {children}

      <InsightLockedBlock />
    </section>
  );
}
