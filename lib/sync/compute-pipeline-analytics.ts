/**
 * Calcule les PipelineAnalytics (open deals, totals, weighted, attractiveness)
 * UNIQUEMENT depuis Supabase local. Aucun appel HubSpot.
 *
 * Cette fonction remplace l'usage de fetchPipelineDataAtomic dans le bloc
 * Pipeline Management — qui faisait des Search API HubSpot live et pouvait
 * timeout/429, donnant des "0 partout" intermittents.
 *
 * Source de vérité :
 *   - snapshot.pipelines (structure : id, label, stages avec probability)
 *   - deals table (raw_data.properties + colonnes typées)
 *
 * Garantit cohérence avec tout le reste de Revold qui lit le même cache.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineAnalytics, HsPipeline } from "@/lib/integrations/hubspot-pipelines";
import type { PipelineInfo } from "@/lib/integrations/hubspot-snapshot";

type DealRow = {
  pipeline_external_id: string | null;
  stage_external_id: string | null;
  amount: number | null;
  is_closed_won: boolean | null;
  is_closed_lost: boolean | null;
  raw_data: Record<string, unknown> | null;
  hs_last_modified_at: string | null;
};

function fromRaw(d: DealRow, key: string): string | null {
  const props = (d.raw_data?.properties as Record<string, string | null>) ?? {};
  return props[key] ?? null;
}

function daysInStage(d: DealRow): number {
  const ms = Number(fromRaw(d, "hs_time_in_latest_deal_stage") ?? 0);
  if (ms > 0) return Math.round(ms / 86_400_000);
  // fallback : jours depuis hs_lastmodifieddate
  if (d.hs_last_modified_at) {
    const t = new Date(d.hs_last_modified_at).getTime();
    if (t > 0) return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  }
  return 0;
}

function activitiesCount(d: DealRow): number {
  const n = Number(fromRaw(d, "num_notes") ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function closeDateValue(d: DealRow): string | null {
  return fromRaw(d, "closedate");
}

async function fetchAllDeals(supabase: SupabaseClient, orgId: string): Promise<DealRow[]> {
  const out: DealRow[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("deals")
      .select("pipeline_external_id, stage_external_id, amount, is_closed_won, is_closed_lost, raw_data, hs_last_modified_at")
      .eq("organization_id", orgId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as unknown as DealRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function pipelineInfoToHsPipeline(p: PipelineInfo): HsPipeline {
  return {
    id: p.id,
    label: p.label,
    stages: p.stages.map((s) => ({
      id: s.id,
      label: s.label,
      displayOrder: s.displayOrder,
      probability: s.probability * 100, // PipelineInfo: 0-1, HsPipeline: 0-100
    })),
  };
}

export async function computePipelineAnalyticsFromLocal(
  supabase: SupabaseClient,
  orgId: string,
  pipelinesInfo: PipelineInfo[],
): Promise<PipelineAnalytics[]> {
  const allDeals = await fetchAllDeals(supabase, orgId);
  const hsPipelines = pipelinesInfo.map(pipelineInfoToHsPipeline);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86_400_000;

  return hsPipelines.map((pipeline) => {
    const pipelineDeals = allDeals.filter((d) => d.pipeline_external_id === pipeline.id);
    const openDeals = pipelineDeals.filter(
      (d) => !Boolean(d.is_closed_won) && !Boolean(d.is_closed_lost),
    );
    const wonCount = pipelineDeals.filter((d) => Boolean(d.is_closed_won)).length;
    const lostCount = pipelineDeals.filter((d) => Boolean(d.is_closed_lost)).length;

    const totalDeals = openDeals.length;
    const totalAmount = openDeals.reduce((s, d) => s + (d.amount ?? 0), 0);

    const stageAnalytics = pipeline.stages
      .map((stage) => {
        const stageDeals = openDeals.filter((d) => d.stage_external_id === stage.id);
        const amount = stageDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
        const weighted = amount * (stage.probability / 100);
        const avgDays =
          stageDeals.length > 0
            ? Math.round(stageDeals.reduce((s, d) => s + daysInStage(d), 0) / stageDeals.length)
            : 0;
        return {
          stage,
          dealCount: stageDeals.length,
          amount,
          weightedAmount: weighted,
          weightedPct: 0, // computed below
          avgDaysInStage: avgDays,
        };
      })
      .filter((s) => s.dealCount > 0);

    const totalWeighted = stageAnalytics.reduce((s, sa) => s + sa.weightedAmount, 0);
    stageAnalytics.forEach((sa) => {
      sa.weightedPct = totalWeighted > 0 ? Math.round((sa.weightedAmount / totalWeighted) * 100) : 0;
    });

    const efficientStages = stageAnalytics
      .filter((sa) => sa.avgDaysInStage > 0 && sa.avgDaysInStage <= 7)
      .map((sa) => ({ label: sa.stage.label, avgDays: sa.avgDaysInStage, dealCount: sa.dealCount }));

    const stagnantStages = stageAnalytics
      .filter((sa) => sa.avgDaysInStage > 21)
      .map((sa) => ({ label: sa.stage.label, avgDays: sa.avgDaysInStage, dealCount: sa.dealCount }))
      .sort((a, b) => b.avgDays - a.avgDays);

    // Attractiveness audit
    const avgActivities =
      totalDeals > 0
        ? Math.round((openDeals.reduce((s, d) => s + activitiesCount(d), 0) / totalDeals) * 10) / 10
        : 0;

    const dealsWithFreshClose = openDeals.filter((d) => {
      const cd = closeDateValue(d);
      if (!cd) return false;
      const closeTs = new Date(cd).getTime();
      const modTs = d.hs_last_modified_at ? new Date(d.hs_last_modified_at).getTime() : 0;
      return closeTs > now || modTs > thirtyDaysAgo;
    }).length;
    const closeDateFreshPct =
      totalDeals > 0 ? Math.round((dealsWithFreshClose / totalDeals) * 100) : 0;

    const totalLifetime = totalDeals + wonCount + lostCount;
    const lostRate = totalLifetime > 0 ? Math.round((lostCount / totalLifetime) * 100) : 0;

    const forecastReliable = closeDateFreshPct >= 60 && avgActivities >= 2 && lostRate < 50;

    const attractivenessScore = Math.round(
      Math.min(30, avgActivities * 8) +
        Math.min(30, closeDateFreshPct * 0.3) +
        Math.max(0, 25 - lostRate * 0.5) +
        (forecastReliable ? 15 : 0),
    );

    return {
      pipeline,
      totalDeals,
      totalAmount,
      weightedAmount: totalWeighted,
      stages: stageAnalytics,
      efficientStages,
      stagnantStages,
      attractiveness: {
        score: attractivenessScore,
        avgActivities,
        closeDateFreshPct,
        wonCount,
        lostCount,
        lostRate,
        forecastReliable,
      },
    };
  });
}
