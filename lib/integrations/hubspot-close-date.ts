/**
 * Close Date Management — sortie utilisée dans Forecast Management.
 *
 * Buckets RevOps :
 *   - passedCloseDate     : deals OUVERTS dont close date est dans le passé.
 *   - quarters[T1..T4]    : deals OUVERTS dont close date tombe dans chacun
 *                           des 4 trimestres de l'année courante.
 *
 * On filtre directement par date côté Search API HubSpot (pas de
 * HAS_PROPERTY closedate, peu fiable selon les portails).
 */

const HS_API = "https://api.hubapi.com";

export type CloseDateDeal = {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  amount: number;
  /** Probabilité de l'étape HubSpot (0-100), pour calcul forecast pondéré. */
  stageProbability: number;
  /** amount × stageProbability / 100 — forecast pondéré du deal. */
  weightedAmount: number;
  ownerId: string | null;
  closeDate: string | null;
  daysOverdue: number; // négatif possible (à venir)
};

export type QuarterBucket = {
  key: "T1" | "T2" | "T3" | "T4";
  label: string; // ex: "T1 2026"
  start: string; // ISO
  end: string;   // ISO
  deals: CloseDateDeal[];
};

export type CloseDateBuckets = {
  pipelineId: string | null;
  year: number;
  passedCloseDate: CloseDateDeal[];
  quarters: QuarterBucket[];
};

function quarterRanges(year: number): Array<{
  key: "T1" | "T2" | "T3" | "T4";
  label: string;
  start: Date;
  end: Date;
}> {
  return [
    { key: "T1", label: `T1 ${year}`, start: new Date(year, 0, 1), end: new Date(year, 3, 0, 23, 59, 59, 999) },
    { key: "T2", label: `T2 ${year}`, start: new Date(year, 3, 1), end: new Date(year, 6, 0, 23, 59, 59, 999) },
    { key: "T3", label: `T3 ${year}`, start: new Date(year, 6, 1), end: new Date(year, 9, 0, 23, 59, 59, 999) },
    { key: "T4", label: `T4 ${year}`, start: new Date(year, 9, 1), end: new Date(year, 12, 0, 23, 59, 59, 999) },
  ];
}

async function searchDeals(
  token: string,
  filterGroups: Array<{ filters: Array<Record<string, string>> }>,
  pipelineId: string | null,
  stageProbabilities: Map<string, number>,
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
        const stageId = props.dealstage || "";
        const amount = Number(props.amount) || 0;
        const stageProbability = stageProbabilities.get(stageId) ?? 0;
        const weightedAmount = Math.round((amount * stageProbability) / 100);
        all.push({
          id: r.id as string,
          name: props.dealname || `Deal ${r.id}`,
          pipelineId: props.pipeline || pipelineId || "default",
          stageId,
          amount,
          stageProbability,
          weightedAmount,
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
  stageProbabilities: Map<string, number> = new Map(),
): Promise<CloseDateBuckets> {
  const year = new Date().getFullYear();
  const ranges = quarterRanges(year);
  const now = Date.now();

  const baseFilters: Array<Record<string, string>> = [
    { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
  ];
  if (pipelineId) {
    baseFilters.push({ propertyName: "pipeline", operator: "EQ", value: pipelineId });
  }

  const passedFilters = [
    ...baseFilters,
    { propertyName: "closedate", operator: "LT", value: String(now) },
  ];

  const [passedCloseDate, ...quarterDeals] = await Promise.all([
    searchDeals(token, [{ filters: passedFilters }], pipelineId, stageProbabilities, 1000),
    ...ranges.map((r) =>
      searchDeals(
        token,
        [
          {
            filters: [
              ...baseFilters,
              {
                propertyName: "closedate",
                operator: "BETWEEN",
                value: String(r.start.getTime()),
                highValue: String(r.end.getTime()),
              } as unknown as Record<string, string>,
            ],
          },
        ],
        pipelineId,
        stageProbabilities,
        1000,
      ),
    ),
  ]);

  const quarters: QuarterBucket[] = ranges.map((r, i) => ({
    key: r.key,
    label: r.label,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
    deals: quarterDeals[i] ?? [],
  }));

  return { pipelineId, year, passedCloseDate, quarters };
}
