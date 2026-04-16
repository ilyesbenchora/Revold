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

type SeverityCounts = { critical: number; warning: number; info: number };

function countSeverities(items: Array<{ severity: string }>): SeverityCounts {
  let critical = 0, warning = 0, info = 0;
  for (const i of items) {
    if (i.severity === "critical") critical++;
    else if (i.severity === "warning") warning++;
    else info++;
  }
  return { critical, warning, info };
}

export default async function MesCoachingPage() {
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
    {
      id: "commercial", label: "Commercial", description: "Deals, pipeline, closing, workflows",
      sev: countSeverities(insightsByCategory.commercial),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
    },
    {
      id: "marketing", label: "Marketing", description: "Leads, conversion, acquisition",
      sev: countSeverities(insightsByCategory.marketing),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    },
    {
      id: "data", label: "Data", description: "Qualité et enrichissement des données",
      sev: countSeverities(insightsByCategory.data),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg>,
    },
    {
      id: "integration", label: "Intégration", description: "Adoption outils et rapports suggérés",
      sev: countSeverities(visibleIntegrationInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>,
    },
    {
      id: "cross-source", label: "Cross-Source", description: "Insights multi-sources",
      sev: countSeverities(crossSourceInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98" /><path d="M15.41 6.51l-6.82 3.98" /></svg>,
    },
    {
      id: "data-model", label: "Modèle de données", description: "Audit CRM et recommandations",
      sev: countSeverities(dataModelInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    },
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
    severity?: string;
    category?: string;
    created_at: string;
  }>;
  const doneInsights = dismissalsList.filter((d) => !d.status || d.status === "done");
  const removedInsights = dismissalsList.filter((d) => d.status === "removed");

  return (
    <div className="space-y-8">
      {/* Coaching réalisé */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          Coaching réalisé
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{doneInsights.length}</span>
        </h2>
        {doneInsights.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">Aucun coaching réalisé pour le moment. Marquez vos recommandations comme faites depuis les sous-pages.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {doneInsights.slice(0, 8).map((d) => {
              const sevColor = d.severity === "critical" ? "bg-red-50 text-red-700" : d.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
              const sevLabel = d.severity === "critical" ? "Critique" : d.severity === "warning" ? "Attention" : "Info";
              const catLabel = d.category === "commercial" ? "Commercial" : d.category === "marketing" ? "Marketing" : d.category === "data" ? "Data" : d.category === "automation" ? "Workflow" : d.category === "integration" ? "Intégration" : d.category ?? "";
              return (
                <article key={d.id} className="card border-l-4 border-l-emerald-400 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.severity && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sevColor}`}>{sevLabel}</span>
                        )}
                        {catLabel && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{catLabel}</span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-sm font-medium text-slate-900">{d.title || d.template_key}</h3>
                      {d.body && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{d.body}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </article>
              );
            })}
            {doneInsights.length > 8 && (
              <p className="text-center text-xs text-slate-400">+ {doneInsights.length - 8} autres coaching réalisés</p>
            )}
          </div>
        )}
      </div>

      {/* Coaching retiré */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
          Coaching retiré
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{removedInsights.length}</span>
        </h2>
        {removedInsights.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">Aucun coaching retiré.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {removedInsights.slice(0, 8).map((d) => {
              const catLabel = d.category === "commercial" ? "Commercial" : d.category === "marketing" ? "Marketing" : d.category === "data" ? "Data" : d.category === "automation" ? "Workflow" : d.category === "integration" ? "Intégration" : d.category ?? "";
              return (
                <article key={d.id} className="card border-l-4 border-l-slate-300 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {catLabel && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{catLabel}</span>
                      )}
                      <h3 className="mt-1.5 text-sm font-medium text-slate-600">{d.title || d.template_key}</h3>
                      {d.body && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{d.body}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </article>
              );
            })}
            {removedInsights.length > 8 && (
              <p className="text-center text-xs text-slate-400">+ {removedInsights.length - 8} autres coaching retirés</p>
            )}
          </div>
        )}
      </div>

      {/* Category navigation cards */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Coaching par catégorie</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const total = cat.sev.critical + cat.sev.warning + cat.sev.info;
            return (
              <Link
                key={cat.id}
                href={`/dashboard/insights-ia/${cat.id}`}
                className="card group flex items-start gap-3 p-4 transition hover:border-accent/30 hover:shadow-md"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-accent/10 transition">
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent transition">{cat.label}</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-accent transition">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{cat.description}</p>
                  {total > 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                      {cat.sev.critical > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                          {cat.sev.critical}
                        </span>
                      )}
                      {cat.sev.warning > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                          {cat.sev.warning}
                        </span>
                      )}
                      {cat.sev.info > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                          {cat.sev.info}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-emerald-600 font-medium">Tout est en ordre</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
