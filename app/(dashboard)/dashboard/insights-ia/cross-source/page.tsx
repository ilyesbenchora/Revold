export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CoachingPageTabs } from "@/components/coaching-page-tabs";
import { MultiToolBanner } from "@/components/multi-tool-banner";
import { getConnectedTools, summarizeConnected, connectedCategoriesSet } from "@/lib/integrations/connected-tools";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching } from "@/lib/reports/coaching-types";
import { fetchDismissals, fetchCrossSourceInsights } from "../context";

export default async function CrossSourceCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { dismissedKeys } = await fetchDismissals(supabase, orgId);
  const connectedTools = await getConnectedTools(supabase, orgId);
  const connectedSummary = summarizeConnected(connectedTools);
  const connectedCats = connectedCategoriesSet(connectedTools);
  const [crossSourceInsights, manualCoachings] = await Promise.all([
    fetchCrossSourceInsights(supabase, orgId, dismissedKeys, connectedCats),
    fetchReportCoachings(supabase, orgId, "cross-source", ["active", "done", "removed"]),
  ]);

  const allItems: UnifiedCoaching[] = [
    ...crossSourceInsights.map((i): UnifiedCoaching => ({
      id: `auto-${i.key}`,
      source: "auto",
      templateKey: i.key,
      severity: i.severity,
      title: i.title,
      body: i.body,
      recommendation: i.recommendation,
      hubspotUrl: "/dashboard/rapports",
      actionLabel: "Voir le rapport associé",
      category: "cross-source",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: "/dashboard/rapports", title: i.title, body: i.body, recommendation: i.recommendation, category: "cross-source" }),
    })),
    ...manualCoachings.map((m): UnifiedCoaching => ({
      id: `manual-${m.id}`,
      source: "manual",
      reportCoachingId: m.id,
      severity: m.severity,
      title: m.title,
      body: m.body,
      recommendation: m.recommendation ?? m.body,
      hubspotUrl: undefined,
      category: "cross-source",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "cross-source" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return (
    <div className="space-y-6">
      <MultiToolBanner summary={connectedSummary} />
      <CoachingPageTabs allItems={allItems} categoryLabel="cross-sources" />
    </div>
  );
}
