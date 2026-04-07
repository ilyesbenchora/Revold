import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { KpiChart } from "@/components/kpi-chart";
import { getScoreLabel, getScoreTextColor, getStrokeColor } from "@/lib/score-utils";

type DealRow = {
  id: string;
  name: string;
  amount: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  is_at_risk: boolean;
  last_activity_at: string | null;
  days_in_stage: number;
  companies: { name: string } | null;
  pipeline_stages: { name: string; is_closed_won: boolean; is_closed_lost: boolean } | null;
  activity_count: number;
};

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const k = await getLatestKpi();
  const salesScore = Number(k?.sales_score) || 0;

  const [
    { data: snapshots },
    { count: totalDeals },
    { count: atRiskDeals },
    { count: wonDealsCount },
    { data: wonDealsAmount },
    { data: openDealsRaw },
    { data: stagnantDealsRaw },
  ] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("snapshot_date, closing_rate, pipeline_coverage, sales_score")
      .eq("organization_id", orgId)
      .order("snapshot_date", { ascending: true })
      .limit(7),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_at_risk", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true),
    // Open deals with details (limit to avoid timeout)
    supabase
      .from("deals")
      .select("id, name, amount, is_at_risk, last_activity_at, days_in_stage, companies(name), pipeline_stages(name, is_closed_won, is_closed_lost)")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .order("amount", { ascending: false })
      .limit(50),
    // Stagnant deals: last_activity > 6 days ago
    supabase
      .from("deals")
      .select("id, name, amount, last_activity_at, companies(name)")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .lt("last_activity_at", new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString())
      .order("last_activity_at", { ascending: true })
      .limit(20),
  ]);

  const wonAmount = (wonDealsAmount ?? []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const openDeals = (openDealsRaw ?? []) as unknown as DealRow[];
  const openAmount = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const stagnantDeals = stagnantDealsRaw ?? [];

  // Get activity counts for open deals
  const openDealIds = openDeals.map((d) => d.id);
  let activityCounts = new Map<string, number>();
  if (openDealIds.length > 0) {
    const { data: activities } = await supabase
      .from("activities")
      .select("deal_id")
      .in("deal_id", openDealIds);
    (activities ?? []).forEach((a) => {
      if (a.deal_id) activityCounts.set(a.deal_id, (activityCounts.get(a.deal_id) || 0) + 1);
    });
  }

  const dealsWithActivity = openDeals.map((d) => ({
    ...d,
    activityCount: activityCounts.get(d.id) || 0,
    companyName: (d.companies as unknown as { name: string } | null)?.name ?? "—",
    stageName: (d.pipeline_stages as unknown as { name: string } | null)?.name ?? "—",
  }));

  const mostWorkedDeals = [...dealsWithActivity].sort((a, b) => b.activityCount - a.activityCount).slice(0, 5);
  const leastWorkedDeals = [...dealsWithActivity].sort((a, b) => a.activityCount - b.activityCount).slice(0, 5);

  const closingRate = Number(k?.closing_rate) || 0;
  const pipelineCoverage = Number(k?.pipeline_coverage) || 0;
  const cycleDays = Number(k?.sales_cycle_days) || 0;
  const weightedForecast = Number(k?.weighted_forecast) || 0;

  const scenarios = [
    {
      title: `Si le taux de closing passe de ${closingRate}% à ${Math.min(100, closingRate + 10)}%`,
      impact: weightedForecast > 0
        ? `+€${Math.round(weightedForecast * 0.1 / 1000)}K de prévision pondérée`
        : "+10% de revenus prévisionnels",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: `Si le cycle de vente passe de ${cycleDays}j à ${Math.max(20, cycleDays - 10)}j`,
      impact: `Vélocité pipeline améliorée de ~${Math.round(10 / Math.max(1, cycleDays) * 100)}%, closing plus rapide`,
      color: "border-indigo-200 bg-indigo-50",
    },
    {
      title: `Si la couverture pipeline passe de ${pipelineCoverage}x à ${Math.max(pipelineCoverage, 3).toFixed(1)}x`,
      impact: "Réduction du risque de sous-performance, meilleure prévisibilité du trimestre",
      color: "border-emerald-200 bg-emerald-50",
    },
    {
      title: `Si ${stagnantDeals.length} deals stagnants sont réactivés`,
      impact: stagnantDeals.length > 0
        ? `Récupération potentielle de €${Math.round(stagnantDeals.reduce((s, d) => s + Number(d.amount || 0), 0) / 1000)}K de pipeline`
        : "Aucun deal stagnant détecté",
      color: "border-amber-200 bg-amber-50",
    },
  ];

  const kpis = [
    { label: "Taux de closing", value: k?.closing_rate ? `${k.closing_rate}%` : "—", description: "Pourcentage de deals conclus positivement" },
    { label: "Couverture pipeline", value: k?.pipeline_coverage ? `${k.pipeline_coverage}x` : "—", description: "Ratio pipeline sur objectif de vente" },
    { label: "Cycle de vente", value: cycleDays > 0 ? `${cycleDays} jours` : "—", description: "Durée moyenne entre création et closing" },
    { label: "Prévision pondérée", value: k?.weighted_forecast ? `€${(k.weighted_forecast / 1000000).toFixed(2)}M` : "—", description: "Montant prévisionnel ajusté par probabilité" },
    { label: "Vélocité deals", value: k?.deal_velocity ? `€${(Number(k.deal_velocity) / 1000).toFixed(1)}K par jour` : "—", description: "Valeur traitée par jour de pipeline" },
  ];

  const chartData = (snapshots ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    closingRate: Number(s.closing_rate),
    pipelineCoverage: Number(s.pipeline_coverage),
  }));

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performance Commerciale</h1>
          <p className="mt-1 text-sm text-slate-500">KPIs de performance de l&apos;équipe commerciale.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">{totalDeals ?? 0} deals</span>
          <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">{atRiskDeals ?? 0} à risque</span>
        </div>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Sales" score={salesScore} colorClass="stroke-blue-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{salesScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(salesScore).className}`}>{getScoreLabel(salesScore).label}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">Performance globale de l&apos;équipe commerciale.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />KPIs Sales
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="card p-5">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="mt-2 text-xs text-slate-400">{kpi.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals créés</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalDeals ?? 0}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Montant en cours</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">€{(openAmount / 1000).toFixed(0)}K</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Transactions gagnées</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{wonDealsCount ?? 0}</p>
            <p className="mt-1 text-xs text-slate-400">€{(wonAmount / 1000).toFixed(0)}K</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals stagnants</p>
            <p className={`mt-1 text-3xl font-bold ${stagnantDeals.length > 5 ? "text-red-500" : stagnantDeals.length > 2 ? "text-orange-500" : "text-emerald-600"}`}>
              {stagnantDeals.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Dernière activité &gt; 6j</p>
          </article>
        </div>

        {mostWorkedDeals.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Deals les + travaillés</p>
              </div>
              <div className="divide-y divide-card-border">
                {mostWorkedDeals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">{d.companyName} · {d.stageName}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {d.activityCount} activité{d.activityCount > 1 ? "s" : ""}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">€{(Number(d.amount) / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Deals les - travaillés</p>
              </div>
              <div className="divide-y divide-card-border">
                {leastWorkedDeals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">{d.companyName} · {d.stageName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.activityCount === 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
                        {d.activityCount} activité{d.activityCount > 1 ? "s" : ""}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">€{(Number(d.amount) / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {chartData.length > 1 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Tendances
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.closingRate }))} label="Taux de closing (%)" color="#6366f1" format={(v) => `${v}%`} />
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.pipelineCoverage }))} label="Couverture pipeline (x)" color="#818cf8" format={(v) => `${v}x`} />
          </div>
        </div>
      )}

      {k && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
              <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
              <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
            </svg>
            Insight IA — Scénarios What/If
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {scenarios.map((s, i) => (
              <article key={i} className={`rounded-xl border p-5 ${s.color}`}>
                <p className="text-sm font-medium text-slate-800">{s.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-900">{s.impact}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!k && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Aucune donnée disponible.</p>
        </div>
      )}
    </section>
  );
}
