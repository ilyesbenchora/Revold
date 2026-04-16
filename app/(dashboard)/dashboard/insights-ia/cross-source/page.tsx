import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { fetchDismissals, fetchCrossSourceInsights } from "../context";
import Link from "next/link";

export default async function CrossSourceCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { dismissedKeys } = await fetchDismissals(supabase, orgId);
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys);

  return (
    <section className="space-y-6">
      <header>
        <Link href="/dashboard/insights-ia" className="text-xs text-slate-400 hover:text-accent transition">
          &larr; Mes coaching IA
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <span className="h-3 w-3 rounded-full bg-fuchsia-500" />
            Coaching Cross-Source
            {crossSourceInsights.length > 0 && (
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{crossSourceInsights.length}</span>
            )}
          </h1>
          <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Multi-sources
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Insights impossibles avec un seul outil — Revold croise vos sources connectées pour faire ressortir les fuites revenue et risques cachés.
        </p>
      </header>

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
    </section>
  );
}
