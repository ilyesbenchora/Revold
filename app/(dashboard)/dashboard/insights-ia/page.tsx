import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

const severityConfig = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique", dot: "bg-red-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention", dot: "bg-amber-500" },
  info: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Info", dot: "bg-indigo-500" },
} as const;

const categoryLabels: Record<string, string> = {
  pipeline: "Pipeline",
  deal_risk: "Deal \u00e0 risque",
  forecast: "Pr\u00e9vision",
  coaching: "Coaching",
  marketing: "Marketing",
  data: "Data",
  sales: "Commercial",
};

// Map insight categories to our 3 blocs
function classifyInsight(category: string): "commercial" | "marketing" | "data" {
  if (["pipeline", "deal_risk", "forecast", "coaching", "sales"].includes(category)) return "commercial";
  if (["marketing"].includes(category)) return "marketing";
  if (["data"].includes(category)) return "data";
  // Default: commercial
  return "commercial";
}

type Insight = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  recommendation: string | null;
  generated_at: string;
  deal_id: string | null;
  deals: { name: string } | null;
};

function InsightCard({ insight }: { insight: Insight }) {
  const config = severityConfig[insight.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const dealName = (insight.deals as unknown as { name: string } | null)?.name;

  return (
    <article className={`rounded-xl border p-5 ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.badge}`}>
            {config.label}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {categoryLabels[insight.category] ?? insight.category}
          </span>
          {dealName && (
            <span className="text-xs text-slate-500">&middot; {dealName}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {new Date(insight.generated_at).toLocaleDateString("fr-FR")}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-slate-900">{insight.title}</h3>
      <p className="mt-1.5 text-sm text-slate-700">{insight.body}</p>

      {insight.recommendation && (
        <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{insight.recommendation}</p>
        </div>
      )}
    </article>
  );
}

export default async function InsightsPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const { data: insights } = await supabase
    .from("ai_insights")
    .select("*, deals(name)")
    .eq("organization_id", orgId)
    .eq("is_dismissed", false)
    .order("generated_at", { ascending: false });

  // Fetch latest KPI for simulation context
  const { data: latestKpi } = await supabase
    .from("kpi_snapshots")
    .select("closing_rate, pipeline_coverage, mql_to_sql_rate, data_completeness, sales_score, marketing_score, crm_ops_score, weighted_forecast, inactive_deals_pct, activities_per_deal")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  // Fetch integrations for integration simulation bloc
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, is_active, metadata")
    .eq("organization_id", orgId);

  // Fetch sync logs for integration performance
  const { data: syncLogs } = await supabase
    .from("sync_logs")
    .select("source, status, entity_count")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const allInsights = (insights ?? []) as Insight[];

  // Classify into 3 blocs
  const commercialInsights = allInsights.filter((i) => classifyInsight(i.category) === "commercial");
  const marketingInsights = allInsights.filter((i) => classifyInsight(i.category) === "marketing");
  const dataInsights = allInsights.filter((i) => classifyInsight(i.category) === "data");

  const criticalCount = allInsights.filter((i) => i.severity === "critical").length;
  const warningCount = allInsights.filter((i) => i.severity === "warning").length;

  // Simulation scenarios based on current KPIs
  const k = latestKpi;
  const closingRate = Number(k?.closing_rate) || 0;
  const pipelineCoverage = Number(k?.pipeline_coverage) || 0;
  const mqlToSql = Number(k?.mql_to_sql_rate) || 0;
  const dataCompleteness = Number(k?.data_completeness) || 0;
  const weightedForecast = Number(k?.weighted_forecast) || 0;
  const inactiveDeals = Number(k?.inactive_deals_pct) || 0;
  const activitiesPerDeal = Number(k?.activities_per_deal) || 0;

  // Integration simulation data
  const activeIntegrations = (integrations ?? []).filter((i) => i.is_active);
  const allSyncs = syncLogs ?? [];
  const successSyncs = allSyncs.filter((l) => l.status === "success" || l.status === "completed");
  const syncRate = allSyncs.length > 0 ? Math.round((successSyncs.length / allSyncs.length) * 100) : 0;
  const totalSynced = successSyncs.reduce((sum, l) => sum + (l.entity_count || 0), 0);

  const integrationSimulations = [
    {
      tool: "HubSpot",
      connected: activeIntegrations.some((i) => i.provider === "hubspot"),
      simulations: [
        {
          title: "Augmenter la fr\u00e9quence de sync \u00e0 1h",
          impact: inactiveDeals > 10
            ? `R\u00e9duction estim\u00e9e des deals inactifs de ${inactiveDeals}% \u00e0 ~${Math.max(5, inactiveDeals - 8)}%`
            : "Maintien de la fra\u00eecheur des donn\u00e9es et d\u00e9tection plus rapide des risques",
          effort: "Faible",
          priority: inactiveDeals > 15 ? "Haute" : "Moyenne",
        },
        {
          title: "Activer le sync bidirectionnel des activit\u00e9s",
          impact: activitiesPerDeal < 3
            ? `Am\u00e9lioration du tracking : de ${activitiesPerDeal} \u00e0 ~${(activitiesPerDeal + 2).toFixed(1)} activit\u00e9s/deal`
            : "Visibilit\u00e9 compl\u00e8te du parcours client dans les deux sens",
          effort: "Moyen",
          priority: activitiesPerDeal < 3 ? "Haute" : "Basse",
        },
        {
          title: "Mapper les champs personnalis\u00e9s",
          impact: dataCompleteness < 80
            ? `Compl\u00e9tude donn\u00e9es de ${dataCompleteness}% \u2192 ~${Math.min(95, dataCompleteness + 15)}% (+fiabilit\u00e9 scoring IA)`
            : "Harmonisation compl\u00e8te du mod\u00e8le de donn\u00e9es",
          effort: "Moyen",
          priority: dataCompleteness < 70 ? "Haute" : "Moyenne",
        },
      ],
    },
    {
      tool: "Salesforce",
      connected: activeIntegrations.some((i) => i.provider === "salesforce"),
      simulations: [
        {
          title: "Connecter Salesforce pour unifier le pipeline",
          impact: "Vue 360\u00b0 des opportunit\u00e9s multi-CRM, am\u00e9lioration du forecast de 15-25%",
          effort: "Moyen",
          priority: "Haute",
        },
        {
          title: "Synth\u00e9tiser les rapports Salesforce dans Revold",
          impact: "R\u00e9duction du temps d\u2019analyse RevOps de ~40%, dashboards unifi\u00e9s",
          effort: "\u00c9lev\u00e9",
          priority: "Moyenne",
        },
      ],
    },
  ];

  const scenarios = [
    {
      label: "Si le taux de closing passe de {current}% \u00e0 {target}%",
      current: closingRate,
      target: Math.min(100, closingRate + 10),
      impact: weightedForecast > 0
        ? `+\u20ac${((weightedForecast * ((closingRate + 10) / 100 - closingRate / 100)) / 1000).toFixed(0)}K de pr\u00e9vision`
        : "+10% de revenus pr\u00e9visionnels",
      color: "border-blue-200 bg-blue-50",
      iconColor: "text-blue-600",
      category: "Commercial",
    },
    {
      label: "Si la couverture pipeline passe de {current}x \u00e0 {target}x",
      current: pipelineCoverage,
      target: Math.max(pipelineCoverage, 3),
      impact: "Am\u00e9lioration de la pr\u00e9visibilit\u00e9 et r\u00e9duction du risque de sous-performance",
      color: "border-indigo-200 bg-indigo-50",
      iconColor: "text-indigo-600",
      category: "Commercial",
    },
    {
      label: "Si le MQL\u2192SQL passe de {current}% \u00e0 {target}%",
      current: mqlToSql,
      target: Math.min(100, mqlToSql + 15),
      impact: `+${Math.round((mqlToSql + 15) / Math.max(1, mqlToSql) * 100 - 100)}% de leads qualifi\u00e9s dans le pipeline`,
      color: "border-amber-200 bg-amber-50",
      iconColor: "text-amber-600",
      category: "Marketing",
    },
    {
      label: "Si la compl\u00e9tude donn\u00e9es passe de {current}% \u00e0 {target}%",
      current: dataCompleteness,
      target: Math.min(100, dataCompleteness + 20),
      impact: "Am\u00e9lioration de la fiabilit\u00e9 des scores et recommandations IA",
      color: "border-emerald-200 bg-emerald-50",
      iconColor: "text-emerald-600",
      category: "Data",
    },
  ];

  const blocs = [
    {
      id: "commercial",
      label: "Insights Commerciaux",
      description: "Pipeline, deals, forecast et coaching",
      dot: "bg-blue-500",
      insights: commercialInsights,
      emptyMsg: "Aucun insight commercial pour le moment.",
    },
    {
      id: "marketing",
      label: "Insights Marketing",
      description: "Funnel, leads, conversion et acquisition",
      dot: "bg-amber-500",
      insights: marketingInsights,
      emptyMsg: "Aucun insight marketing pour le moment.",
    },
    {
      id: "data",
      label: "Insights Data",
      description: "Qualit\u00e9 des donn\u00e9es, compl\u00e9tude et hygi\u00e8ne CRM",
      dot: "bg-emerald-500",
      insights: dataInsights,
      emptyMsg: "Aucun insight data pour le moment.",
    },
  ];

  return (
    <section className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Insights IA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Analyses et sc\u00e9narios de simulation g\u00e9n\u00e9r\u00e9s par l&apos;IA.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">
            {allInsights.length} insight{allInsights.length > 1 ? "s" : ""}
          </span>
          {criticalCount > 0 && (
            <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">
              {criticalCount} critique{criticalCount > 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">
              {warningCount} attention
            </span>
          )}
        </div>
      </header>

      {/* Simulation Scenarios */}
      {k && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
              <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
            </svg>
            Sc\u00e9narios de simulation
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {scenarios.map((scenario, i) => (
              <article key={i} className={`rounded-xl border p-5 ${scenario.color}`}>
                <div className="flex items-start justify-between">
                  <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {scenario.category}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={scenario.iconColor}>
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">
                  {scenario.label
                    .replace("{current}", String(scenario.current))
                    .replace("{target}", String(scenario.target))}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{scenario.impact}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Integration Simulation Bloc */}
      {k && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Simulations Int&eacute;gration
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              Outils CRM
            </span>
          </h2>
          <p className="text-sm text-slate-400">
            Optimisations sugg&eacute;r&eacute;es par l&apos;IA bas&eacute;es sur vos KPIs et l&apos;utilisation de vos outils int&eacute;gr&eacute;s.
          </p>

          {/* Sync health overview */}
          <div className="grid grid-cols-3 gap-4">
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-400">Outils actifs</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{activeIntegrations.length}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-400">Fiabilit&eacute; sync</p>
              <p className={`mt-1 text-2xl font-bold ${
                syncRate >= 80 ? "text-emerald-600" : syncRate >= 50 ? "text-amber-500" : "text-red-500"
              }`}>{syncRate}%</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-400">Entit&eacute;s sync&eacute;es</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalSynced.toLocaleString("fr-FR")}</p>
            </article>
          </div>

          {/* Per-tool simulations */}
          <div className="space-y-4">
            {integrationSimulations.map((tool) => (
              <div key={tool.tool} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-900">{tool.tool}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tool.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {tool.connected ? "Connect\u00e9" : "Non connect\u00e9"}
                    </span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
                  </svg>
                </div>
                <div className="divide-y divide-card-border">
                  {tool.simulations.map((sim, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{sim.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{sim.impact}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            sim.priority === "Haute" ? "bg-red-50 text-red-700" :
                            sim.priority === "Moyenne" ? "bg-amber-50 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {sim.priority}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Effort: {sim.effort}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight Blocs */}
      {blocs.map((bloc) => (
        <div key={bloc.id} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
            {bloc.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {bloc.insights.length}
            </span>
          </h2>
          <p className="text-sm text-slate-400">{bloc.description}</p>

          {bloc.insights.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">{bloc.emptyMsg}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bloc.insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>
      ))}

      {allInsights.length === 0 && !k && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucun insight disponible. Les analyses IA appara\u00eetront une fois les donn\u00e9es synchronis\u00e9es.
          </p>
        </div>
      )}
    </section>
  );
}
