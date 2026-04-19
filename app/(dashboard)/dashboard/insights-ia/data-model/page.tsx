import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CoachingPageTabs } from "@/components/coaching-page-tabs";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { inferActionType, type UnifiedCoaching, type CoachingSeverity } from "@/lib/reports/coaching-types";
import { buildContext, fetchDismissals, fetchIntegrationInsights, fetchDataModelInsights } from "../context";

export default async function DataModelCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [ctx, { dismissedKeys }, { detectedIntegrations }, manualCoachings] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    fetchReportCoachings(supabase, orgId, "data-model", ["active", "done", "removed"]),
  ]);

  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  const sevMap: Record<string, CoachingSeverity> = {
    critical: "critical",
    warning: "warning",
    info: "info",
    success: "info",
  };

  const allItems: UnifiedCoaching[] = [
    ...dataModelInsights.map((i): UnifiedCoaching => {
      const hubspotUrl = i.category === "missing_tool" ? "/dashboard/integration" : "/dashboard/parametres/modele-donnees";
      const actionLabel = i.category === "missing_tool" ? "Connecter l'outil" : "Configurer le data model";
      return {
        id: `auto-${i.id}`,
        source: "auto",
        templateKey: i.id,
        severity: sevMap[i.severity] ?? "info",
        title: i.title,
        body: i.body,
        recommendation: i.recommendation,
        hubspotUrl,
        actionLabel,
        category: "data-model",
        actionType: inferActionType({ templateKey: i.id, hubspotUrl, title: i.title, body: i.body, recommendation: i.recommendation, category: "data-model" }),
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
      category: "data-model",
      actionType: inferActionType({ title: m.title, body: m.body, recommendation: m.recommendation ?? "", category: "data-model" }),
      status: m.status,
      createdAt: m.created_at,
      sourceReportTitle: m.source_report_title,
      kpiLabel: m.kpi_label,
    })),
  ];

  return <CoachingPageTabs allItems={allItems} categoryLabel="modèle de données" />;
}
