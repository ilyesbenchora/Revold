/**
 * Récupère les deals pour le bloc "Close Date Management" :
 *   - passedCloseDate : deals OUVERTS dont close date est dans le passé
 *   - currentQuarter  : deals OUVERTS dont close date tombe dans le trimestre courant
 */

const HS_API = "https://api.hubapi.com";

export type CloseDateDeal = {
  id: string;
  name: string;
  stageId: string;
  amount: number;
  ownerId: string | null;
  closeDate: string | null;
  daysOverdue: number; // négatif si pas encore arrivé
};

export type CloseDateBuckets = {
  pipelineId: string;
  passedCloseDate: CloseDateDeal[];
  currentQuarter: CloseDateDeal[];
  quarterLabel: string;
};

function quarterRange(date = new Date()): { start: Date; end: Date; label: string } {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3);
  const year = date.getFullYear();
  const start = new Date(year, quarter * 3, 1);
  const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
  const label = `T${quarter + 1} ${year}`;
  return { start, end, label };
}

async function fetchOpenDealsWithCloseDate(
  token: string,
  pipelineId: string,
): Promise<CloseDateDeal[]> {
  const properties = [
    "dealname",
    "dealstage",
    "amount",
    "hubspot_owner_id",
    "closedate",
  ];

  const all: CloseDateDeal[] = [];
  let after: string | undefined;
  const now = Date.now();

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
                { propertyName: "closedate", operator: "HAS_PROPERTY" },
              ],
            },
          ],
          properties,
          sorts: [{ propertyName: "closedate", direction: "ASCENDING" }],
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
        const closeDate = props.closedate ?? null;
        const closeTs = closeDate ? new Date(closeDate).getTime() : 0;
        const daysOverdue = closeTs > 0 ? Math.round((now - closeTs) / 86_400_000) : 0;
        all.push({
          id: r.id as string,
          name: props.dealname || `Deal ${r.id}`,
          stageId: props.dealstage || "",
          amount: Number(props.amount) || 0,
          ownerId: props.hubspot_owner_id || null,
          closeDate,
          daysOverdue,
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

export async function fetchCloseDateBuckets(
  token: string,
  pipelineId: string,
): Promise<CloseDateBuckets> {
  const deals = await fetchOpenDealsWithCloseDate(token, pipelineId);
  const now = Date.now();
  const { start, end, label } = quarterRange();

  const passedCloseDate = deals
    .filter((d) => {
      if (!d.closeDate) return false;
      return new Date(d.closeDate).getTime() < now;
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const currentQuarter = deals
    .filter((d) => {
      if (!d.closeDate) return false;
      const t = new Date(d.closeDate).getTime();
      return t >= start.getTime() && t <= end.getTime();
    })
    .sort((a, b) => {
      const ta = a.closeDate ? new Date(a.closeDate).getTime() : 0;
      const tb = b.closeDate ? new Date(b.closeDate).getTime() : 0;
      return ta - tb;
    });

  return { pipelineId, passedCloseDate, currentQuarter, quarterLabel: label };
}
