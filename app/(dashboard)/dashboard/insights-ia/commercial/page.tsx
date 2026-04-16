import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { buildContext, fetchDismissals, fetchTrackingStats, selectInsights, hubspotLinks } from "../context";

export default async function CommercialCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [ctx, { dismissedKeys }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
  ]);

  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const insights = insightsByCategory.commercial;

  return (
    <div className="space-y-4">
      {insights.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Toutes les recommandations commerciales ont été traitées.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.key}
              templateKey={insight.key}
              severity={insight.severity}
              title={insight.title}
              body={insight.body}
              recommendation={insight.recommendation}
              hubspotUrl={hubspotLinks.commercial}
              category="commercial"
            />
          ))}
        </div>
      )}
    </div>
  );
}
