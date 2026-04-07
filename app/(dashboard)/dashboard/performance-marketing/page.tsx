import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { KpiChart } from "@/components/kpi-chart";
import { getScoreLabel } from "@/lib/score-utils";

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const k = await getLatestKpi();
  const marketingScore = Number(k?.marketing_score) || 0;

  const [
    { data: snapshots },
    { count: totalContacts },
    { count: mqlCount },
    { count: sqlCount },
    { count: contactsWithCompany },
    { count: contactsWithoutCompany },
    { count: emailCount },
  ] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("snapshot_date, mql_to_sql_rate, lead_velocity_rate, funnel_leakage_rate")
      .eq("organization_id", orgId)
      .order("snapshot_date", { ascending: true })
      .limit(7),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "email"),
  ]);

  const total = totalContacts ?? 0;
  const mqls = mqlCount ?? 0;
  const sqls = sqlCount ?? 0;
  const withCompany = contactsWithCompany ?? 0;
  const withoutCompany = contactsWithoutCompany ?? 0;
  const emails = emailCount ?? 0;

  const formConversionRate = withCompany > 0 ? Math.round((mqls / Math.max(1, withCompany)) * 100) : 0;

  const kpis = [
    { label: "MQL → SQL", value: k?.mql_to_sql_rate ? `${k.mql_to_sql_rate}%` : "—", description: "Taux de conversion des MQL en SQL" },
    { label: "Vélocité leads", value: k?.lead_velocity_rate ? `+${k.lead_velocity_rate}%` : "—", description: "Croissance mensuelle du volume de leads" },
    { label: "Fuite funnel", value: k?.funnel_leakage_rate ? `${k.funnel_leakage_rate}%` : "—", description: "Taux de perte dans le funnel marketing" },
  ];

  const chartData = (snapshots ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    mqlToSql: Number(s.mql_to_sql_rate),
    leadVelocity: Number(s.lead_velocity_rate),
  }));

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs de performance de l&apos;équipe marketing et du funnel d&apos;acquisition.
        </p>
      </header>

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
            Performance globale marketing basée sur la conversion, la vélocité et la rétention funnel.
          </p>
        </div>
      </div>

      {/* Funnel */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Funnel
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts totaux</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{total}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{mqls}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">SQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{sqls}</p>
          </article>
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />KPIs Marketing
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

      {/* Formulaires */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Formulaires
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withCompany}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Non attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withoutCompany}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${formConversionRate >= 20 ? "text-emerald-600" : formConversionRate >= 10 ? "text-yellow-600" : "text-red-500"}`}>
              {formConversionRate}%
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Emails marketing</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{emails}</p>
          </article>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-amber-500" />Tendances
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.mqlToSql }))} label="MQL → SQL (%)" color="#f59e0b" format={(v) => `${v}%`} />
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.leadVelocity }))} label="Vélocité leads (%)" color="#d97706" format={(v) => `+${v}%`} />
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
