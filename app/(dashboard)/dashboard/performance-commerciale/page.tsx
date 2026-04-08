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

  const [
    { count: totalDeals },
    { count: wonDeals },
    { count: lostDeals },
    { count: openDeals },
    { data: wonAmountData },
    { data: openAmountData },
    { data: stagnantDeals },
    { data: topDeals },
    { data: neglectedDeals },
    { count: dealsWithNextActivity },
    { count: dealsActivated },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true).gt("amount", 0),
    supabase.from("deals").select("amount, forecast_amount").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    // Stagnant: dernière activité commerciale > 7j ET aucune prochaine activité planifiée
    supabase.from("deals").select("id, name, amount, last_contacted_at, next_activity_date, sales_activities_count")
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .is("next_activity_date", null)
      .lt("last_contacted_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("last_contacted_at", { ascending: true }).limit(10),
    // Top deals par activités commerciales
    supabase.from("deals").select("id, name, amount, sales_activities_count, associated_contacts_count")
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .order("sales_activities_count", { ascending: false }).limit(5),
    // Deals négligés (0 activité commerciale)
    supabase.from("deals").select("id, name, amount, created_date, sales_activities_count")
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .eq("sales_activities_count", 0)
      .order("created_date", { ascending: false }).limit(5),
    // Deals en cours avec prochaine activité planifiée
    supabase.from("deals").select("*", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .not("next_activity_date", "is", null),
    // Deals en cours avec au moins une activité commerciale
    supabase.from("deals").select("*", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .gt("sales_activities_count", 0),
  ]);

  const total = totalDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const open = openDeals ?? 0;
  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const wonTotal = (wonAmountData ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const openData = openAmountData ?? [];
  const openTotal = openData.reduce((s, d) => s + Number(d.amount || 0), 0);
  const forecastTotal = openData.reduce((s, d) => s + Number(d.forecast_amount || 0), 0);
  const stagnant = stagnantDeals ?? [];
  const top = topDeals ?? [];
  const neglected = neglectedDeals ?? [];
  const withNext = dealsWithNextActivity ?? 0;
  const withoutNext = open - withNext;
  const activated = dealsActivated ?? 0;
  const notActivated = open - activated;
  const followUpRate = open > 0 ? Math.round((withNext / open) * 100) : 0;
  const activationRate = open > 0 ? Math.round((activated / open) * 100) : 0;

  const salesScore = Math.round(
    Math.min(100, closingRate * 2.5) * 0.4 +
    (stagnant.length < 5 ? 80 : stagnant.length < 15 ? 50 : 20) * 0.3 +
    (neglected.length === 0 ? 100 : neglected.length < 5 ? 60 : 20) * 0.3
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Commerciale</h1>
        <p className="mt-1 text-sm text-slate-500">Suivi du pipeline et de l&apos;activité commerciale.</p>
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

      {/* Pipeline */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Pipeline
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

      {/* Résultats */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Résultats commerciaux
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5">
            <p className="text-xs text-slate-500">Taux de closing</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{(won + lost) > 0 ? `${closingRate}%` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Gagnées sur clôturées</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Revenu généré</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{wonTotal > 0 ? `€${Math.round(wonTotal / 1000)}K` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Montant des transactions gagnées</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Valeur du pipeline</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{openTotal > 0 ? `€${Math.round(openTotal / 1000)}K` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Montant des transactions en cours</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Prévision pondérée</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{forecastTotal > 0 ? `€${Math.round(forecastTotal / 1000)}K` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Montant pondéré par probabilité</p>
          </article>
        </div>
      </div>

      {/* Transactions stagnantes */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />Transactions stagnantes
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stagnant.length > 5 ? "bg-red-50 text-red-700" : stagnant.length > 0 ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>{stagnant.length}</span>
        </h2>
        <p className="text-sm text-slate-400">Dernier contact &gt; 7 jours et aucune prochaine activité planifiée</p>
        {stagnant.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {stagnant.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">
                      Dernier contact : {d.last_contacted_at ? new Date(d.last_contacted_at).toLocaleDateString("fr-FR") : "jamais"}
                      {" · "}{d.sales_activities_count ?? 0} activités
                    </p>
                  </div>
                  {Number(d.amount) > 0 && <p className="text-sm font-medium text-slate-600">€{Math.round(Number(d.amount) / 1000)}K</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-600">Aucune transaction stagnante.</p>
        )}
      </div>

      {/* Suivi des transactions en cours */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Suivi des transactions en cours
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Transactions en cours</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{open}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Avec prochaine activité</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{withNext}</p>
            <p className="mt-1 text-xs text-slate-400">Activité planifiée</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Sans prochaine activité</p>
            <p className={`mt-1 text-3xl font-bold ${withoutNext > open * 0.5 ? "text-red-500" : "text-orange-500"}`}>{withoutNext}</p>
            <p className="mt-1 text-xs text-slate-400">Aucune activité planifiée</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de suivi</p>
            <p className={`mt-1 text-3xl font-bold ${followUpRate >= 70 ? "text-emerald-600" : followUpRate >= 40 ? "text-yellow-600" : "text-red-500"}`}>{followUpRate}%</p>
            <p className="mt-1 text-xs text-slate-400">Deals avec RDV planifié</p>
          </article>
        </div>
      </div>

      {/* Activation commerciale */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Activation commerciale
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals activés</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{activated}</p>
            <p className="mt-1 text-xs text-slate-400">Au moins 1 activité de vente</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals sans activité</p>
            <p className={`mt-1 text-3xl font-bold ${notActivated > open * 0.3 ? "text-red-500" : "text-orange-500"}`}>{notActivated}</p>
            <p className="mt-1 text-xs text-slate-400">Aucune activité de vente</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux d&apos;activation</p>
            <p className={`mt-1 text-3xl font-bold ${activationRate >= 80 ? "text-emerald-600" : activationRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>{activationRate}%</p>
          </article>
        </div>
      </div>

      {/* Activité commerciale */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Activité commerciale
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {top.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Transactions les plus travaillées</p>
              </div>
              <div className="divide-y divide-card-border">
                {top.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">{d.associated_contacts_count ?? 0} contacts associés</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {d.sales_activities_count ?? 0} activités
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {neglected.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Transactions sans activité</p>
              </div>
              <div className="divide-y divide-card-border">
                {neglected.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">Créée le {d.created_date ? new Date(d.created_date).toLocaleDateString("fr-FR") : "—"}</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">0 activité</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
