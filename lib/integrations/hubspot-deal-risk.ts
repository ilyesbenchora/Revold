/**
 * Récupère les deals "à risque" pour un pipeline donné.
 *
 * 3 listes :
 *   - blocked    : deals dans la même étape depuis > 7 jours
 *                  (hs_time_in_latest_deal_stage > 7j)
 *   - noVisibility : deals SANS notes_next_activity_date
 *   - noActivity   : deals dont notes_last_contacted > 10 jours OU jamais
 */

const HS_API = "https://api.hubapi.com";

export type RiskDeal = {
  id: string;
  name: string;
  stageId: string;
  amount: number;
  ownerId: string | null;
  daysInStage: number;
  lastContactedAt: string | null;
  nextActivityDate: string | null;
  closeDate: string | null;
};

export type DealRiskBuckets = {
  pipelineId: string;
  blocked: RiskDeal[];
  noVisibility: RiskDeal[];
  noActivity: RiskDeal[];
};

async function fetchOpenDealsForRisk(
  token: string,
  pipelineId: string,
): Promise<RiskDeal[]> {
  const properties = [
    "dealname",
    "dealstage",
    "amount",
    "hubspot_owner_id",
    "hs_time_in_latest_deal_stage",
    "notes_last_contacted",
    "notes_next_activity_date",
    "closedate",
  ];

  const all: RiskDeal[] = [];
  let after: string | undefined;
  for (let batch = 0; batch < 10; batch++) {
    try {
      const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "pipeline", operator: "EQ", value: pipelineId },
                { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
              ],
            },
          ],
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
        const ms = Number(props.hs_time_in_latest_deal_stage ?? 0);
        const days = Math.round(ms / 86_400_000);
        all.push({
          id: r.id as string,
          name: props.dealname || `Deal ${r.id}`,
          stageId: props.dealstage || "",
          amount: Number(props.amount) || 0,
          ownerId: props.hubspot_owner_id || null,
          daysInStage: days,
          lastContactedAt: props.notes_last_contacted
            ? new Date(parseInt(props.notes_last_contacted, 10)).toISOString()
            : null,
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
  pipelineId: string,
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
