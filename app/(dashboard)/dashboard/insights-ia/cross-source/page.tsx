import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { fetchDismissals, fetchCrossSourceInsights } from "../context";

export default async function CrossSourceCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { dismissedKeys } = await fetchDismissals(supabase, orgId);
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys);

  return (
    <div className="space-y-4">
      {crossSourceInsights.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500">Connectez plusieurs sources de données pour débloquer les insights cross-source.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {crossSourceInsights.map((insight) => (
            <InsightCard
              key={insight.key}
              templateKey={insight.key}
              severity={insight.severity}
              title={insight.title}
              body={insight.body}
              recommendation={insight.recommendation}
              hubspotUrl="/dashboard/rapports"
              actionLabel="Voir le rapport associé"
              category="cross_source"
            />
          ))}
        </div>
      )}
    </div>
  );
}
