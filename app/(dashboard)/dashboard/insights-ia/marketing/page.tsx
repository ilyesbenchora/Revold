import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { buildContext, fetchDismissals, fetchTrackingStats, selectInsights, hubspotLinks } from "../context";
import Link from "next/link";

export default async function MarketingCoachingPage() {
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
  const insights = insightsByCategory.marketing;

  return (
    <section className="space-y-6">
      <header>
        <Link href="/dashboard/insights-ia" className="text-xs text-slate-400 hover:text-accent transition">
          &larr; Mes coaching IA
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          Coaching Marketing
        </h1>
        <p className="mt-1 text-sm text-slate-500">Recommandations sur vos leads, conversion et acquisition.</p>
      </header>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">Toutes les recommandations marketing ont été traitées.</p>
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
              hubspotUrl={hubspotLinks.marketing}
              category="marketing"
            />
          ))}
        </div>
      )}
    </section>
  );
}
