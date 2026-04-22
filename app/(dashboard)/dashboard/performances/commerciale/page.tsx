export const dynamic = "force-dynamic";
// fetchOpenDeals + fetchClosedDealsByPipeline tournent maintenant sur jusqu'à
// 50 batches chacun (5000 deals max) pour ne plus rater de pipelines.
// On laisse 300s à Vercel pour un large compte HubSpot.
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import {
  fetchOpenDeals,
  fetchClosedDealsByPipeline,
  buildPipelineAnalytics,
  type HsPipeline,
  type PipelineAnalytics,
} from "@/lib/integrations/hubspot-pipelines";
import type { PipelineInfo } from "@/lib/integrations/hubspot-snapshot";

const fmtK = (n: number) =>
  n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

type DealLite = {
  id: string;
  name: string;
  amount: number;
  notes_last_contacted: string | null;
  notes_next_activity_date: string | null;
  num_associated_contacts: number;
  num_notes: number;
  createdate: string | null;
};

async function fetchOpenDealsForLists(token: string): Promise<DealLite[]> {
  const all: DealLite[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hs_is_closed", operator: "NEQ", value: "true" }] }],
          properties: [
            "dealname",
            "amount",
            "notes_last_contacted",
            "notes_next_activity_date",
            "num_associated_contacts",
            "num_notes",
            "createdate",
          ],
          sorts: [{ propertyName: "amount", direction: "DESCENDING" }],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const r of data.results ?? []) {
        all.push({
          id: r.id,
          name: r.properties.dealname || "Sans nom",
          amount: parseFloat(r.properties.amount ?? "0"),
          notes_last_contacted: r.properties.notes_last_contacted
            ? new Date(parseInt(r.properties.notes_last_contacted, 10)).toISOString()
            : null,
          notes_next_activity_date: r.properties.notes_next_activity_date,
          num_associated_contacts: parseInt(r.properties.num_associated_contacts ?? "0", 10),
          num_notes: parseInt(r.properties.num_notes ?? "0", 10),
          createdate: r.properties.createdate ?? null,
        });
      }
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 10);
  return all;
}

export default async function PerformanceCommercialePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  // ── Pipeline analytics ──
  // BUG FIX : on n'appelle PLUS fetchPipelines(token) — on utilise
  // snapshot.pipelines qui est déjà cached (5 min TTL via getHubspotSnapshot).
  // Avant : double appel à /crm/v3/pipelines/deals (1 ici + 1 dans le snapshot).
  // Sur les comptes lents ou pendant un timeout, fetchPipelines retournait []
  // → buildPipelineAnalytics([], ...) retournait [] → "Aucun pipeline détecté"
  // alors que snapshot.pipelines avait les données.
  //
  // Les deals open + closed restent en fetch dynamique car ils peuvent évoluer
  // entre les appels — mais on les rend résilients aux échecs (try/catch
  // séparé) pour ne JAMAIS perdre l'affichage des pipelines.
  let pipelineAnalytics: PipelineAnalytics[] = [];
  let openDealsList: DealLite[] = [];
  if (token) {
    // Convertit snapshot.pipelines (PipelineInfo) → HsPipeline pour
    // buildPipelineAnalytics. Aucun fetch supplémentaire.
    const hsPipelines: HsPipeline[] = snapshot.pipelines.map((p) => ({
      id: p.id,
      label: p.label,
      stages: p.stages.map((s) => ({
        id: s.id,
        label: s.label,
        displayOrder: s.displayOrder,
        probability: s.probability * 100, // PipelineInfo stocke 0-1, HsPipeline attend 0-100
      })),
    }));

    // Les 3 fetches deals tournent en parallèle, mais les échecs sont
    // catchés indépendamment pour que les pipelines s'affichent toujours.
    const [openDealRows, closedByPipeline, deals] = await Promise.all([
      fetchOpenDeals(token).catch(() => []),
      fetchClosedDealsByPipeline(token).catch(() => ({ won: {}, lost: {} })),
      fetchOpenDealsForLists(token).catch(() => []),
    ]);
    pipelineAnalytics = buildPipelineAnalytics(hsPipelines, openDealRows, closedByPipeline);
    openDealsList = deals;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Stagnant : pas de next activity AND last contact > 7j ou jamais
  const stagnant = openDealsList
    .filter((d) => {
      if (d.notes_next_activity_date) return false;
      if (!d.notes_last_contacted) return true;
      return new Date(d.notes_last_contacted).getTime() < sevenDaysAgo;
    })
    .slice(0, 10);

  // Top deals (par notes count)
  const topActive = [...openDealsList]
    .filter((d) => d.num_notes > 0 || d.num_associated_contacts > 1)
    .sort((a, b) => b.num_notes - a.num_notes || b.num_associated_contacts - a.num_associated_contacts)
    .slice(0, 5);

  // Neglected (0 note ET 0 contact associé)
  const neglected = openDealsList
    .filter((d) => d.num_notes === 0 && d.num_associated_contacts === 0)
    .sort((a, b) => (b.createdate ?? "").localeCompare(a.createdate ?? ""))
    .slice(0, 5);

  const total = snapshot.totalDeals;
  const won = snapshot.wonDeals;
  const lost = snapshot.lostDeals;
  const open = snapshot.openDeals;
  const closingRate = snapshot.closingRate;
  const wonTotal = snapshot.wonAmount;
  const openTotal = snapshot.totalPipelineAmount;
  const forecastTotal = pipelineAnalytics.reduce((s, p) => s + p.weightedAmount, 0);

  const withNext = open - snapshot.dealsNoNextActivity;
  const withoutNext = snapshot.dealsNoNextActivity;
  const followUpRate = open > 0 ? Math.round((withNext / open) * 100) : 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pipeline et activité commerciale — source HubSpot live
          {total > 0 && ` (${total} deals analysés)`}
        </p>
      </header>

      <PerformancesTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance commerciale"
        previewBody="L'IA Revold identifie les deals à risque, les patterns de closing gagnants et les optimisations de pipeline à fort impact sur votre taux de conversion."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Pipelines HubSpot
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {pipelineAnalytics.length} pipeline{pipelineAnalytics.length > 1 ? "s" : ""}
            </span>
          </h2>
        }
      >
        {pipelineAnalytics.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun pipeline détecté. Vérifiez la connexion HubSpot.
          </p>
        ) : (
          <div className="space-y-6">
            {pipelineAnalytics.map((pa) => {
              const stageColors = ["bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-fuchsia-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-teal-400"];
              return (
              <article key={pa.pipeline.id} className="card overflow-hidden">
                {/* Header pipeline */}
                <div className="flex items-start justify-between border-b border-card-border bg-slate-50 px-5 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{pa.pipeline.label}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {pa.totalDeals} deal{pa.totalDeals > 1 ? "s" : ""} en cours · {pa.pipeline.stages.length} étapes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      {pa.totalAmount > 0 ? fmtK(pa.totalAmount) : "—"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Pondéré : {pa.weightedAmount > 0 ? fmtK(pa.weightedAmount) : "—"}
                    </p>
                  </div>
                </div>

                {/* Répartition CA pondéré par étape (stacked bar + légende) */}
                {pa.stages.length > 0 && pa.weightedAmount > 0 && (
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Répartition CA pondéré par étape</p>
                    <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                      {pa.stages.map((sa, idx) => (
                        <div
                          key={sa.stage.id}
                          className={`${stageColors[idx % stageColors.length]} transition-all`}
                          style={{ width: `${Math.max(2, sa.weightedPct)}%` }}
                          title={`${sa.stage.label} : ${sa.weightedPct}%`}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {pa.stages.map((sa, idx) => (
                        <div key={sa.stage.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${stageColors[idx % stageColors.length]}`} />
                          {sa.stage.label} · <span className="font-semibold">{sa.weightedPct}%</span> · {sa.dealCount} deal{sa.dealCount > 1 ? "s" : ""}
                        </div>
                      ))}
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
                              {sa.amount > 0 ? fmtK(sa.amount) : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-semibold text-slate-700">
                              {sa.weightedAmount > 0 ? fmtK(sa.weightedAmount) : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right text-slate-600">{sa.avgDaysInStage}j</td>
                            <td className="py-1.5 text-right">
                              {sa.avgDaysInStage <= 7 ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Rapide
                                </span>
                              ) : sa.avgDaysInStage <= 21 ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Normal
                                </span>
                              ) : (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  Stagnant
                                </span>
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
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Étapes efficaces (≤ 7j moy.)</p>
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

                {/* Audit d'attractivité — score /100 */}
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
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
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
                      <p className="text-slate-500">Deals gagnés</p>
                      <p className="font-semibold text-emerald-700">{pa.attractiveness.wonCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Taux de perte</p>
                      <p className={`font-semibold ${pa.attractiveness.lostRate < 30 ? "text-emerald-700" : pa.attractiveness.lostRate < 50 ? "text-amber-700" : "text-red-600"}`}>
                        {pa.attractiveness.lostRate}%
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
                      Ce pipeline a un forecast peu fiable :
                      {pa.attractiveness.closeDateFreshPct < 60 ? " les dates de fermeture ne sont pas mises à jour régulièrement" : ""}
                      {pa.attractiveness.closeDateFreshPct < 60 && pa.attractiveness.avgActivities < 2 ? " et" : ""}
                      {pa.attractiveness.avgActivities < 2 ? " les commerciaux ne logguent pas assez d'activités" : ""}
                      {pa.attractiveness.lostRate >= 50 ? `${(pa.attractiveness.closeDateFreshPct < 60 || pa.attractiveness.avgActivities < 2) ? "," : ""} et le taux de perte est élevé (${pa.attractiveness.lostRate}%)` : ""}
                      .
                    </p>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        )}
      </CollapsibleBlock>

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
            <p className="mt-1 text-2xl font-bold text-slate-900">{won + lost > 0 ? `${closingRate}%` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{won} gagnés / {won + lost} clôturés</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">CA Closed Won</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{wonTotal > 0 ? fmtK(wonTotal) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Cumulé historique</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Pipeline ouvert</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{openTotal > 0 ? fmtK(openTotal) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{open} deals actifs</p>
          </article>
          <article className="card p-5">
            <p className="text-xs text-slate-500">Forecast pondéré</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {forecastTotal > 0 ? fmtK(forecastTotal) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Pondéré par probabilité stage</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-orange-500" />Transactions stagnantes
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                stagnant.length > 5
                  ? "bg-red-50 text-red-700"
                  : stagnant.length > 0
                  ? "bg-orange-50 text-orange-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {stagnant.length}
            </span>
          </h2>
        }
      >
        <p className="text-sm text-slate-400">
          Pas de next activity ET dernier contact &gt; 7 jours (ou jamais)
        </p>
        {stagnant.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {stagnant.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">
                      Dernier contact :{" "}
                      {d.notes_last_contacted ? new Date(d.notes_last_contacted).toLocaleDateString("fr-FR") : "jamais"}
                      {" · "}
                      {d.num_notes ?? 0} note{(d.num_notes ?? 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                  {d.amount > 0 && <p className="text-sm font-medium text-slate-600">{fmtK(d.amount)}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-600">Aucune transaction stagnante.</p>
        )}
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Suivi des transactions en cours
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Deals en cours</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{open}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Avec next activity</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{withNext}</p>
            <p className="mt-1 text-xs text-slate-400">notes_next_activity_date</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Sans next activity</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                withoutNext > open * 0.5 ? "text-red-500" : "text-orange-500"
              }`}
            >
              {withoutNext}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de suivi</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                followUpRate >= 70
                  ? "text-emerald-600"
                  : followUpRate >= 40
                  ? "text-yellow-600"
                  : "text-red-500"
              }`}
            >
              {followUpRate}%
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Activité commerciale
          </h2>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {topActive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Deals les plus travaillés</p>
              </div>
              <div className="divide-y divide-card-border">
                {topActive.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">
                        {d.num_associated_contacts} contact{d.num_associated_contacts > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {d.num_notes} note{d.num_notes > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {neglected.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-card-border px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">Deals sans activité</p>
              </div>
              <div className="divide-y divide-card-border">
                {neglected.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-400">
                        Créée le {d.createdate ? new Date(d.createdate).toLocaleDateString("fr-FR") : "—"}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      0 note
                    </span>
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
