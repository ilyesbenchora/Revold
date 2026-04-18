import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { ReportCoachingsSection } from "@/components/report-coachings-section";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { fetchDismissals, fetchIntegrationInsights } from "../context";

export default async function IntegrationCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [{ dismissedKeys }, { integrationInsights, totalReportSuggestions }, reportCoachings] = await Promise.all([
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    fetchReportCoachings(supabase, orgId, "integration"),
  ]);

  const visibleInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));

  return (
    <div className="space-y-6">
      <ReportCoachingsSection coachings={reportCoachings} category="integration" />
      {totalReportSuggestions > 0 && (
        <p className="text-sm text-indigo-600">
          {totalReportSuggestions} rapport{totalReportSuggestions > 1 ? "s" : ""} suggéré{totalReportSuggestions > 1 ? "s" : ""}
        </p>
      )}

      {visibleInsights.length === 0 && reportCoachings.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Aucune recommandation d&apos;intégration pour le moment.</p>
        </div>
      ) : (
        <div className={`space-y-3 ${visibleInsights.length > 4 ? "max-h-[600px] overflow-y-auto scroll-smooth pr-1" : ""}`}
          style={visibleInsights.length > 4 ? { scrollbarWidth: "thin" } : undefined}>
          {visibleInsights.map((insight) => (
            <InsightCard
              key={insight.key}
              templateKey={insight.key}
              severity={insight.severity}
              title={insight.title}
              body={insight.body}
              recommendation={insight.recommendation}
              hubspotUrl={insight.key.startsWith("int_report_") || insight.key === "int_global_low_stack"
                ? "/dashboard/rapports"
                : "/dashboard/integration"}
              actionLabel={insight.key.startsWith("int_report_")
                ? "Voir le rapport suggéré"
                : insight.key === "int_global_low_stack"
                ? "Découvrir les rapports"
                : "Voir l'intégration"}
              category="integration"
            />
          ))}
        </div>
      )}
    </div>
  );
}
