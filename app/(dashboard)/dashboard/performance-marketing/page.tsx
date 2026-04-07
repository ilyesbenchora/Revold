import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  let k;
  let total = 0;
  let mqls = 0;
  let sqls = 0;
  let assigned = 0;
  let unassigned = 0;
  let emails = 0;

  try {
    const supabase = await createSupabaseServerClient();
    k = await getLatestKpi();

    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", true),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
      supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "email"),
    ]);

    total = r1.count ?? 0;
    mqls = r2.count ?? 0;
    sqls = r3.count ?? 0;
    assigned = r4.count ?? 0;
    unassigned = r5.count ?? 0;
    emails = r6.count ?? 0;
  } catch (err) {
    return <p className="p-8 text-center text-sm text-red-600">Erreur: {String(err)}</p>;
  }

  const marketingScore = Number(k?.marketing_score) || 0;
  const mqlToSql = Number(k?.mql_to_sql_rate) || 0;
  const leadVelocity = Number(k?.lead_velocity_rate) || 0;
  const funnelLeakage = Number(k?.funnel_leakage_rate) || 0;
  const formConversion = assigned > 0 ? Math.round((mqls / Math.max(1, assigned)) * 100) : 0;

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
            <p className="mt-1 text-3xl font-bold text-slate-900">{total.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{mqls.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">SQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{sqls.toLocaleString("fr-FR")}</p>
          </article>
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />KPIs Marketing
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="card p-5">
            <p className="text-xs text-slate-500">MQL vers SQL</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{mqlToSql > 0 ? `${mqlToSql}%` : "—"}</p>
            <p className="mt-2 text-xs text-slate-400">Taux de conversion des MQL en SQL</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Vélocité leads</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{leadVelocity > 0 ? `+${leadVelocity}%` : "—"}</p>
            <p className="mt-2 text-xs text-slate-400">Croissance mensuelle du volume de leads</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Fuite funnel</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{funnelLeakage > 0 ? `${funnelLeakage}%` : "—"}</p>
            <p className="mt-2 text-xs text-slate-400">Taux de perte dans le funnel marketing</p>
          </article>
        </div>
      </div>

      {/* Attribution */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Formulaires et attribution
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{assigned.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Non attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{unassigned.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${formConversion >= 20 ? "text-emerald-600" : formConversion >= 10 ? "text-yellow-600" : "text-red-500"}`}>
              {formConversion}%
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Emails marketing</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{emails.toLocaleString("fr-FR")}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
