import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  let k;
  let totalDeals = 0;
  let atRiskDeals = 0;
  let wonDealsCount = 0;
  let wonAmount = 0;
  let openDealsCount = 0;
  let stagnantCount = 0;
  let openDeals: Array<{ id: string; name: string; amount: number; last_activity_at: string | null }> = [];

  try {
    const supabase = await createSupabaseServerClient();
    k = await getLatestKpi();

    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_at_risk", true),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
      supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
      supabase.from("deals").select("id, name, amount, last_activity_at").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).order("amount", { ascending: false }).limit(10),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).lt("last_activity_at", new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    totalDeals = r1.count ?? 0;
    atRiskDeals = r2.count ?? 0;
    wonDealsCount = r3.count ?? 0;
    wonAmount = (r4.data ?? []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    openDealsCount = r5.count ?? 0;
    openDeals = (r6.data ?? []) as typeof openDeals;
    stagnantCount = r7.count ?? 0;
  } catch (err) {
    return <p className="p-8 text-center text-sm text-red-600">Erreur: {String(err)}</p>;
  }

  const salesScore = Number(k?.sales_score) || 0;
  const closingRate = Number(k?.closing_rate) || 0;
  const pipelineCoverage = Number(k?.pipeline_coverage) || 0;
  const cycleDays = Number(k?.sales_cycle_days) || 0;

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performance Commerciale</h1>
          <p className="mt-1 text-sm text-slate-500">KPIs de performance de l&apos;équipe commerciale.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-slate-600">{totalDeals} deals</span>
          <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">{atRiskDeals} à risque</span>
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
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />KPIs Sales
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <article className="card p-5">
            <p className="text-xs text-slate-500">Taux de closing</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{closingRate > 0 ? `${closingRate}%` : "—"}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Couverture pipeline</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{pipelineCoverage > 0 ? `${pipelineCoverage}x` : "—"}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Cycle de vente</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{cycleDays > 0 ? `${cycleDays} jours` : "—"}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Transactions gagnées</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{wonDealsCount}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Montant gagné</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{wonAmount > 0 ? `€${Math.round(wonAmount / 1000)}K` : "—"}</p>
          </article>
        </div>
      </div>

      {/* Pipeline */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals créés</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalDeals}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals en cours</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{openDealsCount}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals stagnants</p>
            <p className={`mt-1 text-3xl font-bold ${stagnantCount > 5 ? "text-red-500" : stagnantCount > 2 ? "text-orange-500" : "text-emerald-600"}`}>{stagnantCount}</p>
            <p className="mt-1 text-xs text-slate-400">Dernière activité &gt; 6j</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals à risque</p>
            <p className="mt-1 text-3xl font-bold text-red-500">{atRiskDeals}</p>
          </article>
        </div>

        {openDeals.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <p className="text-sm font-semibold text-slate-700">Top deals en cours</p>
            </div>
            <div className="divide-y divide-card-border">
              {openDeals.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{d.name}</p>
                  <p className="text-sm text-slate-600">{Number(d.amount) > 0 ? `€${Math.round(Number(d.amount) / 1000)}K` : "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
