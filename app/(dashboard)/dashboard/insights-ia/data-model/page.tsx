import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { ReportCoachingsSection } from "@/components/report-coachings-section";
import { fetchReportCoachings } from "@/lib/reports/fetch-report-coachings";
import { buildContext, fetchDismissals, fetchIntegrationInsights, fetchDataModelInsights } from "../context";

export default async function DataModelCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys }, { detectedIntegrations }, reportCoachings] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    fetchReportCoachings(supabase, orgId, "data-model"),
  ]);

  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  return (
    <div className="space-y-6">
      <ReportCoachingsSection coachings={reportCoachings} category="data-model" />
      {dataModelInsights.length === 0 && reportCoachings.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Aucune recommandation de modèle de données pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dataModelInsights.map((insight) => {
            const severityMap = {
              critical: "critical" as const,
              warning: "warning" as const,
              info: "info" as const,
              success: "info" as const,
            };

            if (insight.id === "dm_resolution_blueprint") {
              const sections = insight.body.split("\n\n");
              return (
                <article key={insight.id} className="card border-l-4 border-l-indigo-500 p-5">
                  <h3 className="text-base font-semibold text-slate-900">{insight.title}</h3>
                  <div className="mt-3 space-y-4">
                    {sections.map((section, idx) => {
                      const lines = section.split("\n");
                      const header = lines[0];
                      const items = lines.slice(1);
                      const isActiver = header.includes("ACTIVER");
                      const isDesactiver = header.includes("DÉSACTIVER");
                      const badgeClass = isActiver
                        ? "bg-emerald-100 text-emerald-700"
                        : isDesactiver
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700";
                      const icon = isActiver ? "✅" : isDesactiver ? "❌" : "⚙️";
                      return (
                        <div key={idx}>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}>
                            {icon} {header.replace(":", "")}
                          </span>
                          <ul className="mt-2 space-y-1.5">
                            {items.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="mt-0.5 shrink-0 text-slate-400">&rarr;</span>
                                <span>{item.replace(/^→\s*/, "")}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent">
                      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                      <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
                    </svg>
                    <p className="text-xs font-medium text-slate-700">{insight.recommendation}</p>
                  </div>
                </article>
              );
            }

            return (
              <InsightCard
                key={insight.id}
                templateKey={insight.id}
                severity={severityMap[insight.severity]}
                title={insight.title}
                body={insight.body}
                recommendation={insight.recommendation}
                hubspotUrl={insight.category === "missing_tool" ? "/dashboard/integration" : "/dashboard/parametres/modele-donnees"}
                actionLabel={insight.category === "missing_tool" ? "Connecter l'outil" : "Configurer le data model"}
                category="data_model"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
