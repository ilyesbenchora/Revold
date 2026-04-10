import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { fetchPipelines, fetchOpenDeals, fetchLostDealsByPipeline, buildPipelineAnalytics, type PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";

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

  // ── HubSpot Pipeline analytics (direct API call for pipeline/stage names + velocity) ──
  let pipelineAnalytics: PipelineAnalytics[] = [];
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const [pipelines, openDealRows, lostByPipeline] = await Promise.all([
        fetchPipelines(process.env.HUBSPOT_ACCESS_TOKEN),
        fetchOpenDeals(process.env.HUBSPOT_ACCESS_TOKEN),
        fetchLostDealsByPipeline(process.env.HUBSPOT_ACCESS_TOKEN),
      ]);
      pipelineAnalytics = buildPipelineAnalytics(pipelines, openDealRows, lostByPipeline);
    } catch {}
  }

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
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">Suivi du pipeline et de l&apos;activité commerciale.</p>
      </header>

      <PerformancesTabs />

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Commercial" score={salesScore} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{salesScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(salesScore).className}`}>{getScoreLabel(salesScore).label}</span>
          </div>
        </div>
      </div>

      {/* Pipeline — analytics par pipeline HubSpot */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Pipelines
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {pipelineAnalytics.length} pipeline{pipelineAnalytics.length > 1 ? "s" : ""}
            </span>
          </h2>
        }
      >
        {pipelineAnalytics.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun pipeline détecté. Synchronisez HubSpot pour importer vos pipelines.</p>
        ) : (
          <div className="space-y-6">
            {pipelineAnalytics.map((pa) => (
              <article key={pa.pipeline.id} className="card overflow-hidden">
                {/* Pipeline header */}
                <div className="flex items-start justify-between border-b border-card-border bg-slate-50 px-5 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{pa.pipeline.label}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {pa.totalDeals} deal{pa.totalDeals > 1 ? "s" : ""} en cours · {pa.pipeline.stages.length} étapes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      {pa.totalAmount > 0 ? `${Math.round(pa.totalAmount / 1000).toLocaleString("fr-FR")}K €` : "—"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      CA pondéré : {pa.weightedAmount > 0 ? `${Math.round(pa.weightedAmount / 1000).toLocaleString("fr-FR")}K €` : "—"}
                    </p>
                  </div>
                </div>

                {/* Répartition CA pondéré par étape */}
                {pa.stages.length > 0 && (
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Répartition CA pondéré par étape</p>
                    <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                      {pa.stages.map((sa, idx) => {
                        const colors = ["bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-fuchsia-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-teal-400"];
                        return (
                          <div
                            key={sa.stage.id}
                            className={`${colors[idx % colors.length]} transition-all`}
                            style={{ width: `${Math.max(2, sa.weightedPct)}%` }}
                            title={`${sa.stage.label} : ${sa.weightedPct}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {pa.stages.map((sa, idx) => {
                        const dots = ["bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-fuchsia-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-teal-400"];
                        return (
                          <div key={sa.stage.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${dots[idx % dots.length]}`} />
                            {sa.stage.label} · <span className="font-semibold">{sa.weightedPct}%</span> · {sa.dealCount} deal{sa.dealCount > 1 ? "s" : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Détails des étapes */}
                <div className="border-t border-card-border px-5 py-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-medium uppercase text-slate-400">
                          <th className="py-1 pr-4">Étape</th>
                          <th className="py-1 pr-4 text-right">Deals</th>
                          <th className="py-1 pr-4 text-right">CA brut</th>
                          <th className="py-1 pr-4 text-right">CA pondéré</th>
                          <th className="py-1 pr-4 text-right">Moy. jours</th>
                          <th className="py-1 text-right">Vélocité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pa.stages.map((sa) => (
                          <tr key={sa.stage.id} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4 font-medium text-slate-700">{sa.stage.label}</td>
                            <td className="py-1.5 pr-4 text-right text-slate-600">{sa.dealCount}</td>
                            <td className="py-1.5 pr-4 text-right text-slate-600">
                              {sa.amount > 0 ? `${Math.round(sa.amount / 1000).toLocaleString("fr-FR")}K €` : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-semibold text-slate-700">
                              {sa.weightedAmount > 0 ? `${Math.round(sa.weightedAmount / 1000).toLocaleString("fr-FR")}K €` : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right text-slate-600">{sa.avgDaysInStage}j</td>
                            <td className="py-1.5 text-right">
                              {sa.avgDaysInStage <= 7 ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Rapide</span>
                              ) : sa.avgDaysInStage <= 21 ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Normal</span>
                              ) : (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Stagnant</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Étapes efficaces vs stagnantes */}
                <div className="grid grid-cols-1 gap-0 border-t border-card-border md:grid-cols-2 md:divide-x md:divide-card-border">
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Étapes efficaces (&le; 7j moy.)</p>
                    {pa.efficientStages.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {pa.efficientStages.map((s) => (
                          <li key={s.label} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">{s.label}</span>
                            <span className="font-medium text-emerald-600">{s.avgDays}j · {s.dealCount} deal{s.dealCount > 1 ? "s" : ""}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-xs text-slate-400">Aucune étape rapide détectée.</p>}
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Étapes stagnantes (&gt; 21j moy.)</p>
                    {pa.stagnantStages.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {pa.stagnantStages.map((s) => (
                          <li key={s.label} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">{s.label}</span>
                            <span className="font-medium text-red-600">{s.avgDays}j · {s.dealCount} deal{s.dealCount > 1 ? "s" : ""}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-xs text-slate-400">Aucune étape stagnante.</p>}
                  </div>
                </div>

                {/* Attractivité du pipeline */}
                <div className="border-t border-card-border bg-slate-50/50 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Audit d&apos;attractivité</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      pa.attractiveness.score >= 60 ? "bg-emerald-100 text-emerald-700" :
                      pa.attractiveness.score >= 30 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {pa.attractiveness.score}/100
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <p className="text-slate-500">Activités moy./deal</p>
                      <p className={`font-semibold ${pa.attractiveness.avgActivities >= 3 ? "text-emerald-700" : pa.attractiveness.avgActivities >= 1 ? "text-amber-700" : "text-red-600"}`}>
                        {pa.attractiveness.avgActivities}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Close date à jour</p>
                      <p className={`font-semibold ${pa.attractiveness.closeDateFreshPct >= 60 ? "text-emerald-700" : pa.attractiveness.closeDateFreshPct >= 30 ? "text-amber-700" : "text-red-600"}`}>
                        {pa.attractiveness.closeDateFreshPct}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Deals perdus</p>
                      <p className={`font-semibold ${pa.attractiveness.lostRate > 50 ? "text-red-600" : pa.attractiveness.lostRate > 30 ? "text-amber-700" : "text-emerald-700"}`}>
                        {pa.attractiveness.lostCount} ({pa.attractiveness.lostRate}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Forecast</p>
                      <p className={`font-semibold ${pa.attractiveness.forecastReliable ? "text-emerald-700" : "text-red-600"}`}>
                        {pa.attractiveness.forecastReliable ? "Fiable" : "Non fiable"}
                      </p>
                    </div>
                  </div>
                  {!pa.attractiveness.forecastReliable && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                      Ce pipeline a un forecast peu fiable :{" "}
                      {pa.attractiveness.lostRate > 50 ? `${pa.attractiveness.lostRate}% des deals finissent en perdu` : ""}
                      {pa.attractiveness.lostRate > 50 && (pa.attractiveness.closeDateFreshPct < 60 || pa.attractiveness.avgActivities < 2) ? ", " : ""}
                      {pa.attractiveness.closeDateFreshPct < 60 ? "les dates de fermeture ne sont pas mises à jour régulièrement" : ""}
                      {pa.attractiveness.closeDateFreshPct < 60 && pa.attractiveness.avgActivities < 2 ? " et " : ""}
                      {pa.attractiveness.avgActivities < 2 ? "les commerciaux ne logguent pas assez d'activités de vente" : ""}.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </CollapsibleBlock>

      {/* Résultats */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Résultats commerciaux
          </h2>
        }
      >
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
      </CollapsibleBlock>

      {/* Transactions stagnantes */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-orange-500" />Transactions stagnantes
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stagnant.length > 5 ? "bg-red-50 text-red-700" : stagnant.length > 0 ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>{stagnant.length}</span>
          </h2>
        }
      >
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
      </CollapsibleBlock>

      {/* Suivi des transactions en cours */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Suivi des transactions en cours
          </h2>
        }
      >
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
      </CollapsibleBlock>

      {/* Activation commerciale */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Activation commerciale
          </h2>
        }
      >
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
      </CollapsibleBlock>

      {/* Activité commerciale */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Activité commerciale
          </h2>
        }
      >
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
      </CollapsibleBlock>
    </section>
  );
}
