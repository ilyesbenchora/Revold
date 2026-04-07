import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor } from "@/lib/score-utils";

export default async function ProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const [
    { count: totalDeals },
    { count: openDeals },
    { count: dealsWithNextActivity },
    { count: dealsWithoutNextActivity },
    { count: dealsWithActivity },
    { count: dealsNoActivity },
    { count: wonDeals },
    { count: lostDeals },
    { count: totalContacts },
    { count: leadsCount },
    { count: opportunitiesCount },
    { data: topStagnant },
    { data: topActive },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
    // Deals avec une prochaine activité planifiée
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).not("next_activity_date", "is", null),
    // Deals sans prochaine activité
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
    // Deals avec au moins 1 activité commerciale
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).gt("sales_activities_count", 0),
    // Deals sans aucune activité
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_lost", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", false).eq("is_sql", false),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    // Deals stagnants: pas d'activité planifiée + dernier contact > 7j
    supabase.from("deals").select("id, name, amount, last_contacted_at, sales_activities_count")
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .is("next_activity_date", null)
      .order("sales_activities_count", { ascending: true }).limit(5),
    // Deals les mieux suivis
    supabase.from("deals").select("id, name, amount, sales_activities_count, next_activity_date")
      .eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false)
      .not("next_activity_date", "is", null)
      .order("sales_activities_count", { ascending: false }).limit(5),
  ]);

  const total = totalDeals ?? 0;
  const open = openDeals ?? 0;
  const won = wonDeals ?? 0;
  const lost = lostDeals ?? 0;
  const withNext = dealsWithNextActivity ?? 0;
  const withoutNext = dealsWithoutNextActivity ?? 0;
  const withActivity = dealsWithActivity ?? 0;
  const noActivity = dealsNoActivity ?? 0;
  const contacts = totalContacts ?? 0;
  const leads = leadsCount ?? 0;
  const opportunities = opportunitiesCount ?? 0;
  const stagnant = topStagnant ?? [];
  const active = topActive ?? [];

  // Taux de suivi: deals avec prochaine activité planifiée
  const followUpRate = open > 0 ? Math.round((withNext / open) * 100) : 0;
  // Taux d'activation: deals avec au moins 1 activité commerciale
  const activationRate = open > 0 ? Math.round((withActivity / open) * 100) : 0;
  // Lifecycle conversion
  const lifecycleRate = contacts > 0 ? Math.round((opportunities / contacts) * 100) : 0;
  // Closing rate
  const closingRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  const processScore = Math.round(
    followUpRate * 0.35 +
    activationRate * 0.35 +
    Math.min(100, lifecycleRate * 3) * 0.15 +
    Math.min(100, closingRate * 2) * 0.15
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Process</h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi des processus commerciaux, lifecycle et activité de vente.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Process" score={processScore} colorClass="stroke-indigo-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{processScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(processScore).className}`}>
              {getScoreLabel(processScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Basé sur le suivi des transactions, l&apos;activation commerciale et la conversion lifecycle.
          </p>
        </div>
      </div>

      {/* Suivi commercial */}
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
            <p className="mt-1 text-3xl font-bold text-emerald-600">{withActivity}</p>
            <p className="mt-1 text-xs text-slate-400">Au moins 1 activité de vente</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals sans activité</p>
            <p className={`mt-1 text-3xl font-bold ${noActivity > open * 0.3 ? "text-red-500" : "text-orange-500"}`}>{noActivity}</p>
            <p className="mt-1 text-xs text-slate-400">Aucune activité de vente</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux d&apos;activation</p>
            <p className={`mt-1 text-3xl font-bold ${activationRate >= 80 ? "text-emerald-600" : activationRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>{activationRate}%</p>
          </article>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Conversion lifecycle
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{contacts.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Leads</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{leads.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Opportunités</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{opportunities.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${lifecycleRate >= 25 ? "text-emerald-600" : lifecycleRate >= 10 ? "text-yellow-600" : "text-orange-500"}`}>{lifecycleRate}%</p>
            <p className="mt-1 text-xs text-slate-400">Lead vers Opportunité</p>
          </article>
        </div>
      </div>

      {/* Résultat closing */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Résultats du pipeline
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Gagnées</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{won}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Perdues</p>
            <p className="mt-1 text-3xl font-bold text-red-500">{lost}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de closing</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{(won + lost) > 0 ? `${closingRate}%` : "—"}</p>
          </article>
        </div>
      </div>

      {/* Détail deals */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {active.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <p className="text-sm font-semibold text-emerald-700">Transactions les mieux suivies</p>
              <p className="text-xs text-slate-400">Activité planifiée + activités de vente</p>
            </div>
            <div className="divide-y divide-card-border">
              {active.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">
                      Prochain RDV : {d.next_activity_date ? new Date(d.next_activity_date).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {d.sales_activities_count ?? 0} activités
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {stagnant.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <p className="text-sm font-semibold text-red-700">Transactions à relancer</p>
              <p className="text-xs text-slate-400">Sans activité planifiée</p>
            </div>
            <div className="divide-y divide-card-border">
              {stagnant.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">
                      Dernier contact : {d.last_contacted_at ? new Date(d.last_contacted_at).toLocaleDateString("fr-FR") : "jamais"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(d.sales_activities_count ?? 0) === 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
                    {d.sales_activities_count ?? 0} activités
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
