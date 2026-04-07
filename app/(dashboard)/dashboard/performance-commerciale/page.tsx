import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { KpiChart } from "@/components/kpi-chart";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const k = await getLatestKpi();
  const salesScore = Number(k?.sales_score) || 0;

  const [{ data: snapshots }, { count: totalDeals }, { count: atRiskDeals }] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("snapshot_date, closing_rate, pipeline_coverage, sales_score")
      .eq("organization_id", orgId)
      .order("snapshot_date", { ascending: true })
      .limit(7),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_at_risk", true),
  ]);

  const kpis = [
    { label: "Taux de closing", value: k?.closing_rate ? `${k.closing_rate}%` : "\u2014", description: "Pourcentage de deals conclus positivement" },
    { label: "Couverture pipeline", value: k?.pipeline_coverage ? `${k.pipeline_coverage}x` : "\u2014", description: "Ratio pipeline total / objectif de vente" },
    { label: "Cycle de vente", value: k?.sales_cycle_days ? `${k.sales_cycle_days} jours` : "\u2014", description: "Dur\u00e9e moyenne entre cr\u00e9ation et closing" },
    { label: "Pr\u00e9vision pond\u00e9r\u00e9e", value: k?.weighted_forecast ? `\u20ac${(k.weighted_forecast / 1000000).toFixed(2)}M` : "\u2014", description: "Montant pr\u00e9visionnel ajust\u00e9 par probabilit\u00e9" },
    { label: "V\u00e9locit\u00e9 deals", value: k?.deal_velocity ? `\u20ac${(Number(k.deal_velocity) / 1000).toFixed(1)}K/j` : "\u2014", description: "Valeur trait\u00e9e par jour de pipeline" },
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
          <p className="mt-1 text-sm text-slate-500">KPIs de performance de l&apos;\u00e9quipe commerciale.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">{totalDeals ?? 0} deals</span>
          <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">{atRiskDeals ?? 0} \u00e0 risque</span>
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
          <p className="mt-2 text-sm text-slate-500">Performance globale de l&apos;\u00e9quipe commerciale bas\u00e9e sur les KPIs cl\u00e9s.</p>
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

      {chartData.length > 1 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Tendances
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.closingRate }))} label="Taux de closing (%)" color="#6366f1" format={(v) => `${v}%`} />
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.pipelineCoverage }))} label="Couverture pipeline (x)" color="#818cf8" format={(v) => `${v}x`} />
          </div>
        </div>
      )}

      {!k && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Aucune donn\u00e9e disponible. Les m\u00e9triques appara\u00eetront une fois les donn\u00e9es synchronis\u00e9es.</p>
        </div>
      )}
    </section>
  );
}
