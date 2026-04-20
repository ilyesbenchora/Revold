export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

type DealRow = {
  id: string;
  properties: {
    dealname?: string;
    amount?: string | null;
    closedate?: string | null;
    pipeline?: string;
    dealstage?: string;
    hs_deal_stage_probability?: string | null;
    hs_lastmodifieddate?: string;
    notes_last_contacted?: string | null;
    notes_next_activity_date?: string | null;
  };
  associations?: {
    companies?: { results?: Array<{ id: string }> };
  };
};

async function fetchAllDeals(token: string, pipelineId: string): Promise<DealRow[]> {
  const all: DealRow[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }] }],
          properties: [
            "dealname",
            "amount",
            "closedate",
            "pipeline",
            "dealstage",
            "hs_deal_stage_probability",
            "hs_lastmodifieddate",
            "notes_last_contacted",
            "notes_next_activity_date",
          ],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      all.push(...((data.results ?? []) as DealRow[]));
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 50); // cap 5000 deals par pipeline
  return all;
}

async function fetchCompanyNames(token: string, dealIds: string[]): Promise<Record<string, string | null>> {
  if (dealIds.length === 0) return {};
  // Batch read deals associations + company names
  // Simpler approach: use deals associations endpoint (already part of dealsearch with associations)
  // For now: pas critique, retourner vide
  return {};
}

export default async function PipelinePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return (
      <p className="p-8 text-center text-sm text-slate-600">
        Aucune organisation configurée.
      </p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  if (!token || snapshot.pipelines.length === 0) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Connectez votre CRM HubSpot pour visualiser vos deals par étape.
          </p>
        </header>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-8 text-center">
          <p className="text-sm text-slate-700">
            {!token
              ? "HubSpot non connecté. Allez dans la page Intégration."
              : "Aucun pipeline détecté dans HubSpot."}
          </p>
        </div>
      </section>
    );
  }

  // Pipeline principal = celui par défaut (displayOrder 0) ou le 1er non-archivé
  const mainPipeline = snapshot.pipelines.sort((a, b) => a.displayOrder - b.displayOrder)[0];
  const stages = [...mainPipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);

  // Fetch deals du pipeline principal
  const deals = await fetchAllDeals(token, mainPipeline.id);

  // Group par stage
  const byStage: Record<string, DealRow[]> = {};
  for (const stage of stages) byStage[stage.id] = [];
  for (const d of deals) {
    const stageId = d.properties.dealstage ?? "";
    if (byStage[stageId]) byStage[stageId].push(d);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mainPipeline.label} — {deals.length} deals · {stages.length} étapes · données live HubSpot
        </p>
      </header>

      {/* Sélecteur de pipeline si plusieurs */}
      {snapshot.pipelines.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pipelines disponibles :
          </span>
          {snapshot.pipelines.map((p) => (
            <span
              key={p.id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                p.id === mainPipeline.id
                  ? "bg-accent text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = byStage[stage.id] ?? [];
          const total = stageDeals.reduce((sum, d) => sum + parseFloat(d.properties.amount ?? "0"), 0);
          const isClosed = stage.closedWon || stage.closedLost;

          return (
            <div
              key={stage.id}
              className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-card-border bg-white"
            >
              <div className="border-b border-card-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{stage.label}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      stage.closedWon
                        ? "bg-emerald-100 text-emerald-700"
                        : stage.closedLost
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {stageDeals.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {stage.probability}% · {(total / 1000).toFixed(0)}K€
                </p>
              </div>

              <div className="flex-1 space-y-2 p-3">
                {stageDeals.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">Aucun deal</p>
                )}
                {stageDeals
                  .sort(
                    (a, b) =>
                      parseFloat(b.properties.amount ?? "0") -
                      parseFloat(a.properties.amount ?? "0"),
                  )
                  .slice(0, 50)
                  .map((deal) => {
                    const probability = deal.properties.hs_deal_stage_probability
                      ? parseFloat(deal.properties.hs_deal_stage_probability)
                      : stage.probability / 100;
                    const isAtRisk = !isClosed && probability < 0.3;
                    const noNextActivity = !deal.properties.notes_next_activity_date;
                    const lastContacted = deal.properties.notes_last_contacted
                      ? new Date(parseInt(deal.properties.notes_last_contacted, 10))
                      : null;
                    const daysStale = lastContacted
                      ? Math.floor((Date.now() - lastContacted.getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const isStale = !isClosed && noNextActivity && daysStale !== null && daysStale > 7;

                    return (
                      <div
                        key={deal.id}
                        className={`rounded-lg border p-3 text-sm transition hover:shadow-sm ${
                          isAtRisk
                            ? "border-rose-200 bg-rose-50"
                            : isStale
                            ? "border-amber-200 bg-amber-50"
                            : "border-card-border bg-white"
                        }`}
                      >
                        <p className="line-clamp-2 font-medium text-slate-900">
                          {deal.properties.dealname || "Sans nom"}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">
                            {parseFloat(deal.properties.amount ?? "0").toLocaleString("fr-FR")}€
                          </span>
                          {deal.properties.closedate && (
                            <span className="text-xs text-slate-400">
                              {new Date(deal.properties.closedate).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {isAtRisk && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                              À risque ({Math.round(probability * 100)}%)
                            </span>
                          )}
                          {isStale && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Stagnant {daysStale}j
                            </span>
                          )}
                          {noNextActivity && !isStale && !isAtRisk && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              Pas de next step
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {stageDeals.length > 50 && (
                  <p className="py-2 text-center text-[10px] text-slate-400">
                    + {stageDeals.length - 50} autres deals (top 50 affichés)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
