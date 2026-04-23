/**
 * Récupère les deals "à risque" pour un pipeline donné OU pour tous les
 * pipelines.
 *
 * 3 buckets RevOps :
 *   - blocked      : daysInStage > 7 (hs_time_in_latest_deal_stage),
 *                    avec FALLBACK sur hs_lastmodifieddate si la propriété
 *                    n'est pas peuplée (cas fréquent sur deals créés via API).
 *   - noVisibility : notes_next_activity_date manquante
 *   - noActivity   : notes_last_contacted > 10 jours OU jamais
 */

const HS_API = "https://api.hubapi.com";

export type RiskDeal = {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  amount: number;
  ownerId: string | null;
  daysInStage: number;
  lastContactedAt: string | null;
  nextActivityDate: string | null;
  closeDate: string | null;
};

export type DealRiskBuckets = {
  pipelineId: string | null; // null = tous pipelines
  blocked: RiskDeal[];
  noVisibility: RiskDeal[];
  noActivity: RiskDeal[];
};

async function fetchOpenDealsForRisk(
  token: string,
  pipelineId: string | null,
): Promise<RiskDeal[]> {
  const properties = [
    "dealname",
    "pipeline",
    "dealstage",
    "amount",
    "hubspot_owner_id",
    "hs_time_in_latest_deal_stage",
    "hs_lastmodifieddate",
    "notes_last_contacted",
    "notes_next_activity_date",
    "closedate",
  ];

  const baseFilters: Array<Record<string, string>> = [
    { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
  ];
  if (pipelineId) {
    baseFilters.push({ propertyName: "pipeline", operator: "EQ", value: pipelineId });
  }

  const all: RiskDeal[] = [];
  let after: string | undefined;
  const now = Date.now();
  // Cap à 50 batches × 100 = 5000 deals max — largement suffisant pour un
  // pipeline B2B PME/mid-market et borné pour respecter le maxDuration Vercel.
  for (let batch = 0; batch < 50; batch++) {
    try {
      const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: baseFilters }],
          properties,
          sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const results = (data.results ?? []) as Array<Record<string, unknown>>;
      if (results.length === 0) break;
      for (const r of results) {
        const props = (r.properties as Record<string, string | null>) ?? {};

        // daysInStage : on essaie hs_time_in_latest_deal_stage (en ms),
        // sinon fallback sur hs_lastmodifieddate (proxy raisonnable : "n'a pas
        // bougé depuis X jours" ≈ "dans la même étape depuis X jours")
        const ms = Number(props.hs_time_in_latest_deal_stage ?? 0);
        let days = ms > 0 ? Math.round(ms / 86_400_000) : 0;
        if (days === 0 && props.hs_lastmodifieddate) {
          const modTs = new Date(props.hs_lastmodifieddate).getTime();
          if (modTs > 0) days = Math.max(0, Math.floor((now - modTs) / 86_400_000));
        }

        // notes_last_contacted : peut être un timestamp ms (string) OU une
        // ISO date selon comment le portail est configuré
        let lastContactedAt: string | null = null;
        if (props.notes_last_contacted) {
          const raw = props.notes_last_contacted;
          if (/^\d+$/.test(raw)) {
            lastContactedAt = new Date(parseInt(raw, 10)).toISOString();
          } else {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) lastContactedAt = d.toISOString();
          }
        }

        all.push({
          id: r.id as string,
          name: props.dealname || `Deal ${r.id}`,
          pipelineId: props.pipeline || pipelineId || "default",
          stageId: props.dealstage || "",
          amount: Number(props.amount) || 0,
          ownerId: props.hubspot_owner_id || null,
          daysInStage: days,
          lastContactedAt,
          nextActivityDate: props.notes_next_activity_date || null,
          closeDate: props.closedate || null,
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

export async function fetchDealRiskBuckets(
  token: string,
  pipelineId: string | null,
): Promise<DealRiskBuckets> {
  const deals = await fetchOpenDealsForRisk(token, pipelineId);
  const tenDaysAgo = Date.now() - 10 * 86_400_000;

  const blocked = deals
    .filter((d) => d.daysInStage > 7)
    .sort((a, b) => b.daysInStage - a.daysInStage);

  const noVisibility = deals
    .filter((d) => !d.nextActivityDate)
    .sort((a, b) => b.amount - a.amount);

  const noActivity = deals
    .filter((d) => {
      if (!d.lastContactedAt) return true;
      return new Date(d.lastContactedAt).getTime() < tenDaysAgo;
    })
    .sort((a, b) => {
      const ta = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
      const tb = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
      return ta - tb;
    });

  return { pipelineId, blocked, noVisibility, noActivity };
}
