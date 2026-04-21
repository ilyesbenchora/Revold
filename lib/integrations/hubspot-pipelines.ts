/**
 * HubSpot Pipelines helper — fetches the complete pipeline structure
 * (pipeline IDs → labels, stage IDs → labels + probabilities + order)
 * and all open deals with their pipeline/stage/amount/activity data.
 *
 * The HubSpot CRM uses internal IDs for pipelines and stages. This helper
 * resolves them to human-readable names so Revold can display "Pipeline
 * New Business → Étape Qualification" instead of "abc123 → def456".
 */

const HS_API = "https://api.hubapi.com";

export type HsStage = {
  id: string;
  label: string;
  displayOrder: number;
  probability: number;
};

export type HsPipeline = {
  id: string;
  label: string;
  stages: HsStage[];
};

export type HsDealRow = {
  id: string;
  name: string;
  pipeline: string;         // pipeline ID
  dealstage: string;         // stage ID
  amount: number;
  closedate: string | null;
  daysInStage: number;
  salesActivities: number;
  lastModified: string | null;
  ownerId: string | null;
};

export type PipelineAnalytics = {
  pipeline: HsPipeline;
  totalDeals: number;
  totalAmount: number;
  weightedAmount: number;
  stages: Array<{
    stage: HsStage;
    dealCount: number;
    amount: number;
    weightedAmount: number;
    weightedPct: number;        // % of this pipeline's weighted total
    avgDaysInStage: number;
  }>;
  // Efficient = avg days in stage < 7
  efficientStages: Array<{ label: string; avgDays: number; dealCount: number }>;
  // Stagnant = avg days in stage > 21
  stagnantStages: Array<{ label: string; avgDays: number; dealCount: number }>;
  // Attractiveness audit
  attractiveness: {
    score: number;              // 0-100
    avgActivities: number;
    closeDateFreshPct: number;  // % deals with closedate updated in last 30 days
    wonCount: number;           // deals closed-won in this pipeline
    lostCount: number;          // deals closed-lost in this pipeline
    lostRate: number;           // lost / (lost + won + open) as %
    forecastReliable: boolean;
  };
};

/**
 * Fetch all deal pipelines from HubSpot.
 * GET /crm/v3/pipelines/deals
 */
export async function fetchPipelines(token: string): Promise<HsPipeline[]> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Array<Record<string, unknown>>).map((p) => ({
      id: p.pipelineId as string || p.id as string,
      label: p.label as string || `Pipeline ${p.pipelineId || p.id}`,
      stages: ((p.stages as Array<Record<string, unknown>>) ?? [])
        .map((s) => ({
          id: s.stageId as string || s.id as string,
          label: s.label as string || `Stage ${s.stageId || s.id}`,
          displayOrder: Number(s.displayOrder ?? 0),
          probability: Number((s.metadata as Record<string, unknown>)?.probability ?? s.probability ?? 0),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch all open deals with pipeline/stage/amount/activity data.
 * Uses HubSpot Search API to get up to 200 deals (paginated).
 */
export async function fetchOpenDeals(token: string): Promise<HsDealRow[]> {
  const properties = [
    "dealname", "pipeline", "dealstage", "amount", "closedate",
    "hs_time_in_latest_deal_stage", "notes_last_updated",
    "num_notes", "hs_num_associated_active_deal_registrations",
    "hs_lastmodifieddate", "hubspot_owner_id",
    "hs_date_entered_closedwon", "hs_date_entered_closedlost",
  ];

  const all: HsDealRow[] = [];
  let after: string | undefined;

  // Cap relevé de 3 → 50 batches (5000 deals). À 3 batches, le tri amount
  // DESC faisait disparaître les petits deals ET certains pipelines entiers
  // si l'org avait > 300 deals ouverts. Sans ces deals, le buildPipeline
  // Analytics retournait 0 pipeline visible.
  for (let batch = 0; batch < 50; batch++) {
    const body: Record<string, unknown> = {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
        ],
      }],
      properties,
      sorts: [{ propertyName: "amount", direction: "DESCENDING" }],
      limit: 100,
    };
    if (after) body.after = after;

    try {
      const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) break;
      const data = await res.json();
      const results = (data.results ?? []) as Array<Record<string, unknown>>;
      if (results.length === 0) break;

      for (const r of results) {
        const props = (r.properties as Record<string, string | null>) ?? {};
        // hs_time_in_latest_deal_stage is in milliseconds
        const msInStage = Number(props.hs_time_in_latest_deal_stage ?? 0);
        const daysInStage = Math.round(msInStage / 86_400_000);

        all.push({
          id: r.id as string,
          name: props.dealname || `Deal ${r.id}`,
          pipeline: props.pipeline || "default",
          dealstage: props.dealstage || "",
          amount: Number(props.amount) || 0,
          closedate: props.closedate || null,
          daysInStage,
          salesActivities: Number(props.num_notes ?? 0),
          lastModified: props.hs_lastmodifieddate || null,
          ownerId: props.hubspot_owner_id || null,
        });
      }

      after = data.paging?.next?.after;
      if (!after) break;
    } catch {
      break;
    }
  }

  return all;
}

/**
 * Fetch closed deals (won + lost) grouped by pipeline.
 */
export async function fetchClosedDealsByPipeline(
  token: string,
): Promise<{ won: Record<string, number>; lost: Record<string, number> }> {
  const won: Record<string, number> = {};
  const lost: Record<string, number> = {};

  async function fetchClosed(isWon: boolean): Promise<void> {
    let after: string | undefined;
    // Cap relevé de 3 → 50 batches : on a besoin de l'historique COMPLET
    // won/lost par pipeline pour le calcul attractiveness, pas un échantillon.
    for (let batch = 0; batch < 50; batch++) {
      const body: Record<string, unknown> = {
        filterGroups: [{
          filters: [
            { propertyName: "hs_is_closed_won", operator: "EQ", value: isWon ? "true" : "false" },
            { propertyName: "hs_is_closed", operator: "EQ", value: "true" },
          ],
        }],
        properties: ["pipeline"],
        limit: 100,
      };
      if (after) body.after = after;
      try {
        const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) break;
        const data = await res.json();
        const results = (data.results ?? []) as Array<Record<string, unknown>>;
        if (results.length === 0) break;
        const target = isWon ? won : lost;
        for (const r of results) {
          const props = (r.properties as Record<string, string | null>) ?? {};
          const pId = props.pipeline || "default";
          target[pId] = (target[pId] || 0) + 1;
        }
        after = data.paging?.next?.after;
        if (!after) break;
      } catch { break; }
    }
  }

  await Promise.all([fetchClosed(true), fetchClosed(false)]);
  return { won, lost };
}

/**
 * Build per-pipeline analytics from the raw data.
 */
export function buildPipelineAnalytics(
  pipelines: HsPipeline[],
  deals: HsDealRow[],
  closedByPipeline: { won: Record<string, number>; lost: Record<string, number> } = { won: {}, lost: {} },
): PipelineAnalytics[] {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86_400_000;

  return pipelines.map((pipeline) => {
    const pipelineDeals = deals.filter((d) => d.pipeline === pipeline.id);
    const totalDeals = pipelineDeals.length;
    const totalAmount = pipelineDeals.reduce((s, d) => s + d.amount, 0);

    // Build stage-level analytics
    const stageMap = new Map(pipeline.stages.map((s) => [s.id, s]));
    const stageAnalytics = pipeline.stages.map((stage) => {
      const stageDeals = pipelineDeals.filter((d) => d.dealstage === stage.id);
      const amount = stageDeals.reduce((s, d) => s + d.amount, 0);
      const weighted = amount * (stage.probability / 100);
      const avgDays = stageDeals.length > 0
        ? Math.round(stageDeals.reduce((s, d) => s + d.daysInStage, 0) / stageDeals.length)
        : 0;
      return {
        stage,
        dealCount: stageDeals.length,
        amount,
        weightedAmount: weighted,
        weightedPct: 0, // computed below
        avgDaysInStage: avgDays,
      };
    }).filter((s) => s.dealCount > 0);

    const totalWeighted = stageAnalytics.reduce((s, sa) => s + sa.weightedAmount, 0);
    stageAnalytics.forEach((sa) => {
      sa.weightedPct = totalWeighted > 0 ? Math.round((sa.weightedAmount / totalWeighted) * 100) : 0;
    });

    // Efficient stages (avg < 7 days with at least 1 deal)
    const efficientStages = stageAnalytics
      .filter((sa) => sa.avgDaysInStage > 0 && sa.avgDaysInStage <= 7)
      .map((sa) => ({ label: sa.stage.label, avgDays: sa.avgDaysInStage, dealCount: sa.dealCount }));

    // Stagnant stages (avg > 21 days)
    const stagnantStages = stageAnalytics
      .filter((sa) => sa.avgDaysInStage > 21)
      .map((sa) => ({ label: sa.stage.label, avgDays: sa.avgDaysInStage, dealCount: sa.dealCount }))
      .sort((a, b) => b.avgDays - a.avgDays);

    // Attractiveness audit
    const avgActivities = totalDeals > 0
      ? Math.round((pipelineDeals.reduce((s, d) => s + d.salesActivities, 0) / totalDeals) * 10) / 10
      : 0;

    // Close date freshness = % of deals whose closedate is in the future
    // OR whose lastModified is within 30 days (sign of active management)
    const dealsWithFreshClose = pipelineDeals.filter((d) => {
      if (!d.closedate) return false;
      const closeTs = new Date(d.closedate).getTime();
      const modTs = d.lastModified ? new Date(d.lastModified).getTime() : 0;
      return closeTs > now || modTs > thirtyDaysAgo;
    }).length;
    const closeDateFreshPct = totalDeals > 0
      ? Math.round((dealsWithFreshClose / totalDeals) * 100)
      : 0;

    // Won + lost deals for this pipeline
    const wonCount = closedByPipeline.won[pipeline.id] ?? 0;
    const lostCount = closedByPipeline.lost[pipeline.id] ?? 0;
    const totalLifetime = totalDeals + wonCount + lostCount;
    const lostRate = totalLifetime > 0
      ? Math.round((lostCount / totalLifetime) * 100)
      : 0;

    const forecastReliable = closeDateFreshPct >= 60 && avgActivities >= 2 && lostRate < 50;

    // Attractiveness score — includes lost rate as a negative factor.
    // A pipeline where >50% of deals end up lost is structurally weak.
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
  })
    // Garde TOUS les pipelines détectés dans HubSpot (même sans deal ouvert).
    // On affiche au minimum les pipelines qui ont eu un won/lost historique
    // OU qui ont des deals ouverts. Un pipeline complètement vide reste filtré.
    .filter((pa) => pa.totalDeals > 0 || pa.attractiveness.wonCount > 0 || pa.attractiveness.lostCount > 0);
}
