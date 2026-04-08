import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { InsightTabs } from "@/components/insight-tabs";
import { buildDismissedInsights } from "@/lib/ai/insights-helpers";
import { buildContext } from "../context";

export default async function InsightsRealiseesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const ctx = await buildContext(supabase, orgId);

  const { data: dismissals } = await supabase
    .from("insight_dismissals")
    .select("template_key, status, dismissed_at")
    .eq("organization_id", orgId)
    .eq("status", "done")
    .order("dismissed_at", { ascending: false });

  const insights = buildDismissedInsights(ctx, (dismissals ?? []) as Array<{ template_key: string; status: string; dismissed_at: string }>);

  const byCategory = {
    commercial: insights.filter((i) => i.category === "commercial"),
    marketing: insights.filter((i) => i.category === "marketing"),
    data: insights.filter((i) => i.category === "data"),
  };

  const blocs = [
    { id: "commercial" as const, label: "Insights Commerciaux", insights: byCategory.commercial, dot: "bg-blue-500" },
    { id: "marketing" as const, label: "Insights Marketing", insights: byCategory.marketing, dot: "bg-amber-500" },
    { id: "data" as const, label: "Insights Data", insights: byCategory.data, dot: "bg-emerald-500" },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Insights IA réalisés</h1>
        <p className="mt-1 text-sm text-slate-500">Recommandations que vous avez marquées comme faites.</p>
      </header>

      <InsightTabs />

      {insights.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-500">Aucun insight réalisé pour le moment.</p>
          <p className="mt-1 text-xs text-slate-400">Marquez un insight comme fait depuis la page principale pour le retrouver ici.</p>
        </div>
      ) : (
        blocs.map((bloc) => (
          <div key={bloc.id} className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
              {bloc.label}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{bloc.insights.length}</span>
            </h2>
            {bloc.insights.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun insight réalisé dans cette catégorie.</p>
            ) : (
              <div className="space-y-3">
                {bloc.insights.map((i) => (
                  <InsightCard
                    key={i.key}
                    templateKey={i.key}
                    severity={i.severity}
                    title={i.title}
                    body={i.body}
                    recommendation={i.recommendation}
                    showRestore
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
