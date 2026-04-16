import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import {
  buildContext,
  fetchDismissals,
  fetchIntegrationInsights,
  fetchWorkflows,
  fetchCrossSourceInsights,
  fetchDataModelInsights,
  fetchTrackingStats,
  selectInsights,
  hubspotLinks,
} from "./context";

export default async function CoachingIAPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys, doneCount, removedCount }, { detectedIntegrations, integrationInsights }, { workflows, dealsNoOwner }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    fetchWorkflows(token),
  ]);

  const tracking = await fetchTrackingStats();
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys);
  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  const tDeals = ctx.totalDeals;
  const dealsNoOwnerPct = tDeals > 0 ? Math.round((dealsNoOwner / tDeals) * 100) : 0;

  // Count automation insights (same logic as AutomationInsights component)
  const automationCount = 8; // 8 possible automation checks

  const categories = [
    {
      id: "actions",
      label: "Mes actions coaching IA",
      description: "Workflows manquants ou sous-exploités",
      count: automationCount,
      dot: "bg-violet-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
          <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    },
    {
      id: "commercial",
      label: "Coaching Commercial",
      description: "Deals, pipeline, closing rate",
      count: insightsByCategory.commercial.length,
      dot: "bg-blue-500",
      icon: <span className="h-3 w-3 rounded-full bg-blue-500" />,
    },
    {
      id: "marketing",
      label: "Coaching Marketing",
      description: "Leads, conversion, acquisition",
      count: insightsByCategory.marketing.length,
      dot: "bg-amber-500",
      icon: <span className="h-3 w-3 rounded-full bg-amber-500" />,
    },
    {
      id: "data",
      label: "Coaching Data",
      description: "Qualité et enrichissement des données",
      count: insightsByCategory.data.length,
      dot: "bg-emerald-500",
      icon: <span className="h-3 w-3 rounded-full bg-emerald-500" />,
    },
    {
      id: "integration",
      label: "Coaching Intégration",
      description: "Adoption outils et rapports suggérés",
      count: visibleIntegrationInsights.length,
      dot: "bg-indigo-500",
      icon: <span className="h-3 w-3 rounded-full bg-indigo-500" />,
    },
    {
      id: "cross-source",
      label: "Coaching Cross-Source",
      description: "Insights multi-sources impossibles ailleurs",
      count: crossSourceInsights.length,
      dot: "bg-fuchsia-500",
      icon: <span className="h-3 w-3 rounded-full bg-fuchsia-500" />,
    },
    {
      id: "data-model",
      label: "Coaching Modèle de données",
      description: "Audit CRM et recommandations",
      count: dataModelInsights.length,
      dot: "bg-gradient-to-r from-fuchsia-500 to-indigo-500",
      icon: <span className="h-3 w-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" />,
    },
  ];

  const totalActive =
    insightsByCategory.commercial.length +
    insightsByCategory.marketing.length +
    insightsByCategory.data.length +
    visibleIntegrationInsights.length +
    crossSourceInsights.length +
    dataModelInsights.length;

  // Fetch realized/removed insights for inline display
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
    recommendation?: string;
    severity?: string;
    category?: string;
    created_at: string;
  }>;
  const doneInsights = dismissalsList.filter((d) => !d.status || d.status === "done");
  const removedInsights = dismissalsList.filter((d) => d.status === "removed");

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mes coaching IA</h1>
          <p className="mt-1 text-sm text-slate-500">Vue d&apos;ensemble de vos recommandations par catégorie.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">
            {totalActive} actif{totalActive > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {doneCount} réalisé{doneCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
            {removedCount} retiré{removedCount > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/dashboard/insights-ia/${cat.id}`}
            className="card group flex items-start gap-4 p-5 transition hover:border-accent/30 hover:shadow-md"
          >
            <div className="mt-0.5">{cat.icon}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent transition">{cat.label}</h3>
                {cat.count > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {cat.count}
                  </span>
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
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Coaching réalisé
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{doneInsights.length}</span>
          </h2>
          <div className="space-y-3">
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
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Coaching retiré
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{removedInsights.length}</span>
          </h2>
          <div className="space-y-3">
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
    </section>
  );
}
