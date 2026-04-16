import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { fetchDismissals, fetchIntegrationInsights } from "../context";
import Link from "next/link";

export default async function IntegrationCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [{ dismissedKeys }, { integrationInsights, totalReportSuggestions }] = await Promise.all([
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
  ]);

  const visibleInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));

  return (
    <section className="space-y-6">
      <header>
        <Link href="/dashboard/insights-ia" className="text-xs text-slate-400 hover:text-accent transition">
          &larr; Mes coaching IA
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <span className="h-3 w-3 rounded-full bg-indigo-500" />
          Coaching Intégration
          {visibleInsights.length > 0 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{visibleInsights.length}</span>
          )}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyses de l&apos;adoption de vos outils métiers connectés au CRM.
          {totalReportSuggestions > 0 && (
            <span className="ml-2 text-indigo-600">
              {totalReportSuggestions} rapport{totalReportSuggestions > 1 ? "s" : ""} suggéré{totalReportSuggestions > 1 ? "s" : ""}
            </span>
          )}
        </p>
      </header>

      {visibleInsights.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Aucune recommandation d&apos;intégration pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
    </section>
  );
}
