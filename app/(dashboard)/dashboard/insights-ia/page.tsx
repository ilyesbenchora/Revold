import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  buildContext,
  fetchDismissals,
  fetchIntegrationInsights,
  fetchCrossSourceInsights,
  fetchDataModelInsights,
  fetchTrackingStats,
  selectInsights,
} from "./context";

export default async function CoachingOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys }, { detectedIntegrations, integrationInsights }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
  ]);

  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys);
  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  const categories = [
    { id: "commercial", label: "Coaching Commercial", description: "Deals, pipeline, closing, workflows", count: insightsByCategory.commercial.length, dot: "bg-blue-500" },
    { id: "marketing", label: "Coaching Marketing", description: "Leads, conversion, acquisition", count: insightsByCategory.marketing.length, dot: "bg-amber-500" },
    { id: "data", label: "Coaching Data", description: "Qualité et enrichissement des données", count: insightsByCategory.data.length, dot: "bg-emerald-500" },
    { id: "integration", label: "Coaching Intégration", description: "Adoption outils et rapports suggérés", count: visibleIntegrationInsights.length, dot: "bg-indigo-500" },
    { id: "cross-source", label: "Coaching Cross-Source", description: "Insights multi-sources impossibles ailleurs", count: crossSourceInsights.length, dot: "bg-fuchsia-500" },
    { id: "data-model", label: "Coaching Modèle de données", description: "Audit CRM et recommandations", count: dataModelInsights.length, dot: "bg-gradient-to-r from-fuchsia-500 to-indigo-500" },
  ];

  // Fetch realized/removed insights
  const { data: allDismissals } = await supabase
    .from("insight_dismissals")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const dismissalsList = (allDismissals ?? []) as Array<{
    id: string;
    template_key: string;
    status?: string;
    title?: string;
    body?: string;
    created_at: string;
  }>;
  const doneInsights = dismissalsList.filter((d) => !d.status || d.status === "done");
  const removedInsights = dismissalsList.filter((d) => d.status === "removed");

  return (
    <div className="space-y-6">
      {/* Category cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/dashboard/insights-ia/${cat.id}`}
            className="card group flex items-start gap-4 p-5 transition hover:border-accent/30 hover:shadow-md"
          >
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${cat.dot}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent transition">{cat.label}</h3>
                {cat.count > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{cat.count}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{cat.description}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 text-slate-300 group-hover:text-accent transition">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Coaching réalisé */}
      {doneInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Coaching réalisé
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{doneInsights.length}</span>
          </h2>
          <div className="space-y-2">
            {doneInsights.slice(0, 5).map((d) => (
              <article key={d.id} className="card border-l-4 border-l-emerald-400 p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-900">{d.title || d.template_key}</h3>
                  <span className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
                {d.body && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{d.body}</p>}
              </article>
            ))}
            {doneInsights.length > 5 && (
              <p className="text-center text-xs text-slate-400">+ {doneInsights.length - 5} autres coaching réalisés</p>
            )}
          </div>
        </div>
      )}

      {/* Coaching retiré */}
      {removedInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Coaching retiré
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{removedInsights.length}</span>
          </h2>
          <div className="space-y-2">
            {removedInsights.slice(0, 3).map((d) => (
              <article key={d.id} className="card border-l-4 border-l-slate-300 p-4 opacity-70">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-700">{d.title || d.template_key}</h3>
                  <span className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              </article>
            ))}
            {removedInsights.length > 3 && (
              <p className="text-center text-xs text-slate-400">+ {removedInsights.length - 3} autres coaching retirés</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
