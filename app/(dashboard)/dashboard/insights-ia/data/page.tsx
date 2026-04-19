export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CoachingPageTabs } from "@/components/coaching-page-tabs";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching } from "@/lib/reports/coaching-types";
import { buildContext, fetchDismissals, fetchTrackingStats, selectInsights, hubspotLinks } from "../context";

export default async function DataCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [ctx, { dismissedKeys }, manualCoachings] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchReportCoachings(supabase, orgId, "data", ["active", "done", "removed"]),
  ]);

  const tracking = await fetchTrackingStats(token);
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const insights = insightsByCategory.data;

  const allItems: UnifiedCoaching[] = [
    ...insights.map((i): UnifiedCoaching => ({
      id: `auto-${i.key}`,
      source: "auto",
      templateKey: i.key,
      severity: i.severity,
      title: i.title,
      body: i.body,
      recommendation: i.recommendation,
      hubspotUrl: hubspotLinks.data,
      category: "data",
      actionType: inferActionType({ templateKey: i.key, hubspotUrl: hubspotLinks.data, title: i.title, body: i.body, recommendation: i.recommendation, category: "data" }),
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
      category: "data",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "data" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return <CoachingPageTabs allItems={allItems} categoryLabel="data" />;
}
