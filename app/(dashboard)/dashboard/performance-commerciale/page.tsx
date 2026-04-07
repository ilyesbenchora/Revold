import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // All counts in parallel — no heavy data loads
  const [
    { count: totalDeals },
    { count: wonDeals },
    { count: lostDeals },
    { count: openDeals },
    { data: wonAmountData },
    { data: openAmountData },
    { data: recentDeals },
    { data: stagnantDeals },
    { count: dealsWithAmount },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true).gt("amount", 0),
    supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).gt("amount", 0),
    supabase.from("deals").select("id, name, amount, created_date, last_activity_at").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).order("created_date", { ascending: false }).limit(10),
    supabase.from("deals").select("id, name, amount, last_activity_at").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).lt("last_activity_at", new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()).limit(10),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("amount", 0),
  ]);

  const total = totalDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const open = openDeals ?? 0;
  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const wonTotal = (wonAmountData ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const openTotal = (openAmountData ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const stagnant = stagnantDeals ?? [];
  const recent = recentDeals ?? [];
  const withAmount = dealsWithAmount ?? 0;

  // Score: basé sur closing rate + ratio open/total + remplissage montant
  const completenessScore = total > 0 ? Math.round((withAmount / total) * 100) : 0;
  const salesScore = Math.round(
    Math.min(100, closingRate * 2) * 0.4 +
    (total > 0 ? Math.min(100, (open / total) * 150) : 0) * 0.3 +
    completenessScore * 0.3
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Commerciale</h1>
        <p className="mt-1 text-sm text-slate-500">Analyse des transactions et du pipeline commercial.</p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Commercial" score={salesScore} colorClass="stroke-blue-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{salesScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(salesScore).className}`}>{getScoreLabel(salesScore).label}</span>
          </div>
        </div>
      </div>

      {/* Vue pipeline */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Vue pipeline
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Transactions totales</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{total}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">En cours</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{open}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Gagnées</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{won}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Perdues</p>
            <p className="mt-1 text-3xl font-bold text-red-500">{lost}</p>
          </article>
        </div>
      </div>

      {/* KPIs clés */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5">
            <p className="text-xs text-slate-500">Taux de closing</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{(won + lost) > 0 ? `${closingRate}%` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Gagnées sur transactions clôturées</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Montant gagné</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{wonTotal > 0 ? `€${Math.round(wonTotal / 1000)}K` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Valeur des transactions gagnées</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Pipeline en cours</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{openTotal > 0 ? `€${Math.round(openTotal / 1000)}K` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Valeur des transactions ouvertes</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Complétude des montants</p>
            <p className={`mt-1 text-2xl font-bold ${completenessScore >= 70 ? "text-emerald-600" : completenessScore >= 40 ? "text-orange-500" : "text-red-500"}`}>{completenessScore}%</p>
            <p className="mt-1 text-xs text-slate-400">Transactions avec un montant renseigné</p>
          </article>
        </div>
      </div>

      {/* Transactions stagnantes */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />Transactions stagnantes
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{stagnant.length}</span>
        </h2>
        <p className="text-sm text-slate-400">Aucune activité depuis plus de 6 jours</p>
        {stagnant.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {stagnant.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">
                      Dernière activité : {d.last_activity_at ? new Date(d.last_activity_at).toLocaleDateString("fr-FR") : "jamais"}
                    </p>
                  </div>
                  {Number(d.amount) > 0 && <p className="text-sm text-slate-600">€{Math.round(Number(d.amount) / 1000)}K</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune transaction stagnante détectée.</p>
        )}
      </div>

      {/* Dernières transactions créées */}
      {recent.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Dernières transactions créées
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {recent.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">Créée le {d.created_date ? new Date(d.created_date).toLocaleDateString("fr-FR") : "—"}</p>
                  </div>
                  {Number(d.amount) > 0 && <p className="text-sm text-slate-600">€{Math.round(Number(d.amount) / 1000)}K</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
