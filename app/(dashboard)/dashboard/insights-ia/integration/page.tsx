import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CoachingPageTabs } from "@/components/coaching-page-tabs";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching } from "@/lib/reports/coaching-types";
import { fetchDismissals, fetchIntegrationInsights } from "../context";

export default async function IntegrationCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [{ dismissedKeys }, { integrationInsights }, manualCoachings] = await Promise.all([
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    fetchReportCoachings(supabase, orgId, "integration", ["active", "done", "removed"]),
  ]);

  const visibleInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));

  const allItems: UnifiedCoaching[] = [
    ...visibleInsights.map((i): UnifiedCoaching => {
      const isReport = i.key.startsWith("int_report_") || i.key === "int_global_low_stack";
      const hubspotUrl = isReport ? "/dashboard/rapports" : "/dashboard/integration";
      const actionLabel = i.key.startsWith("int_report_")
        ? "Voir le rapport suggéré"
        : i.key === "int_global_low_stack"
          ? "Découvrir les rapports"
          : "Voir l'intégration";
      return {
        id: `auto-${i.key}`,
        source: "auto",
        templateKey: i.key,
        severity: i.severity,
        title: i.title,
        body: i.body,
        recommendation: i.recommendation,
        hubspotUrl,
        actionLabel,
        category: "integration",
        actionType: inferActionType({ templateKey: i.key, hubspotUrl, title: i.title, body: i.body, recommendation: i.recommendation, category: "integration" }),
      };
    }),
    ...manualCoachings.map((m): UnifiedCoaching => ({
      id: `manual-${m.id}`,
      source: "manual",
      reportCoachingId: m.id,
      severity: m.severity,
      title: m.title,
      body: m.body,
      recommendation: m.recommendation ?? m.body,
      hubspotUrl: undefined,
      category: "integration",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "integration" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return <CoachingPageTabs allItems={allItems} categoryLabel="intégration" />;
}
