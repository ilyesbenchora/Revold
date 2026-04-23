/**
 * Close Date Management — sortie utilisée dans Forecast Management.
 *
 * 2 buckets :
 *   - passedCloseDate : deals OUVERTS dont la close date est dans le passé
 *   - currentQuarter  : deals OUVERTS dont la close date tombe dans le
 *                       trimestre courant
 *
 * Ne filtre pas sur HAS_PROPERTY closedate (peu fiable selon les portails) ;
 * on filtre directement par date côté Search API HubSpot.
 */

const HS_API = "https://api.hubapi.com";

export type CloseDateDeal = {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  amount: number;
  ownerId: string | null;
  closeDate: string | null;
  daysOverdue: number;
};

export type CloseDateBuckets = {
  pipelineId: string | null;
  passedCloseDate: CloseDateDeal[];
  currentQuarter: CloseDateDeal[];
  quarterLabel: string;
  quarterStart: string;
  quarterEnd: string;
};

function quarterRange(date = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3);
  const year = date.getFullYear();
  const start = new Date(year, quarter * 3, 1);
  const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
  return { start, end, label: `T${quarter + 1} ${year}` };
}

async function searchDeals(
  token: string,
  filterGroups: Array<{ filters: Array<Record<string, string>> }>,
  pipelineId: string | null,
  max = 1000,
): Promise<CloseDateDeal[]> {
  const properties = [
    "dealname",
    "pipeline",
    "dealstage",
    "amount",
    "hubspot_owner_id",
    "closedate",
  ];

  const all: CloseDateDeal[] = [];
  let after: string | undefined;
  const now = Date.now();
  const batches = Math.ceil(max / 100);

  for (let batch = 0; batch < batches; batch++) {
    try {
      const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups,
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
          pipelineId: props.pipeline || pipelineId || "default",
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
  pipelineId: string | null,
): Promise<CloseDateBuckets> {
  const { start, end, label } = quarterRange();
  const now = Date.now();

  const baseFilters: Array<Record<string, string>> = [
    { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
  ];
  if (pipelineId) {
    baseFilters.push({ propertyName: "pipeline", operator: "EQ", value: pipelineId });
  }

  // Filter HubSpot Search API : LT pour les deals en retard, BETWEEN pour
  // le trimestre courant. Les valeurs sont des timestamps ms (string).
  const passedFilters = [
    ...baseFilters,
    { propertyName: "closedate", operator: "LT", value: String(now) },
  ];
  const quarterFilters = [
    ...baseFilters,
    { propertyName: "closedate", operator: "BETWEEN", value: String(start.getTime()), highValue: String(end.getTime()) } as unknown as Record<string, string>,
  ];

  const [passedCloseDate, currentQuarter] = await Promise.all([
    searchDeals(token, [{ filters: passedFilters }], pipelineId, 1000),
    searchDeals(token, [{ filters: quarterFilters }], pipelineId, 1000),
  ]);

  return {
    pipelineId,
    passedCloseDate,
    currentQuarter,
    quarterLabel: label,
    quarterStart: start.toISOString(),
    quarterEnd: end.toISOString(),
  };
}
