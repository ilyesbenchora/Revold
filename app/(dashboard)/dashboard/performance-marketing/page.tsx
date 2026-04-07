import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { KpiChart } from "@/components/kpi-chart";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const { data: latestKpi } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  const { data: snapshots } = await supabase
    .from("kpi_snapshots")
    .select("snapshot_date, mql_to_sql_rate, lead_velocity_rate, funnel_leakage_rate, marketing_score")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: true })
    .limit(7);

  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  const { count: mqlCount } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_mql", true);

  const { count: sqlCount } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_sql", true);

  const k = latestKpi;
  const marketingScore = Number(k?.marketing_score) || 0;

  const kpis = [
    {
      label: "MQL \u2192 SQL",
      value: k?.mql_to_sql_rate ? `${k.mql_to_sql_rate}%` : "\u2014",
      description: "Taux de conversion des MQL en SQL",
    },
    {
      label: "V\u00e9locit\u00e9 leads",
      value: k?.lead_velocity_rate ? `+${k.lead_velocity_rate}%` : "\u2014",
      description: "Croissance mensuelle du volume de leads",
    },
    {
      label: "Fuite funnel",
      value: k?.funnel_leakage_rate ? `${k.funnel_leakage_rate}%` : "\u2014",
      description: "Taux de perte dans le funnel marketing",
    },
  ];

  const funnelStats = [
    { label: "Contacts totaux", value: totalContacts ?? 0 },
    { label: "MQL", value: mqlCount ?? 0 },
    { label: "SQL", value: sqlCount ?? 0 },
  ];

  const chartData = (snapshots ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    mqlToSql: Number(s.mql_to_sql_rate),
    leadVelocity: Number(s.lead_velocity_rate),
    funnelLeakage: Number(s.funnel_leakage_rate),
  }));

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs de performance de l&apos;\u00e9quipe marketing et du funnel d&apos;acquisition.
        </p>
      </header>

      {/* Score */}
      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Marketing" score={marketingScore} colorClass="stroke-amber-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{marketingScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(marketingScore).className}`}>
              {getScoreLabel(marketingScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Performance globale marketing bas\u00e9e sur la conversion, la v\u00e9locit\u00e9 et la r\u00e9tention funnel.
          </p>
        </div>
      </div>

      {/* Funnel Overview */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Funnel
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {funnelStats.map((stat) => (
            <article key={stat.label} className="card p-5 text-center">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>
            </article>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          KPIs Marketing
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="card p-5">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="mt-2 text-xs text-slate-400">{kpi.description}</p>
            </article>
          ))}
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Tendances
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiChart
              data={chartData.map((d) => ({ date: d.date, value: d.mqlToSql }))}
              label="MQL \u2192 SQL (%)"
              color="#f59e0b"
              format={(v) => `${v}%`}
            />
            <KpiChart
              data={chartData.map((d) => ({ date: d.date, value: d.leadVelocity }))}
              label="V\u00e9locit\u00e9 leads (%)"
              color="#d97706"
              format={(v) => `+${v}%`}
            />
          </div>
        </div>
      )}

      {!latestKpi && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune donn\u00e9e disponible. Les m\u00e9triques appara\u00eetront une fois les donn\u00e9es synchronis\u00e9es.
          </p>
        </div>
      )}
    </section>
  );
}
