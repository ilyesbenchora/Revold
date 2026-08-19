/**
 * Filtre cohorte côté CLIENT — helpers partagés par les blocs de rapport
 * (BlockDataTable, Deals à risque, Forecast management…) : options (standard +
 * cohortes mappées de Paramètres → Cohortes, objet Company), valeurs
 * distinctes, et ids HubSpot des deals dont l'entreprise appartient à la
 * cohorte. Tout est mis en cache au niveau module (une page = un fetch).
 */

export type CohortOption = { id: string; label: string };
export type ActiveCohort = { key: string; value: string };

export const BASE_COHORT_OPTIONS: CohortOption[] = [
  { id: "industry", label: "Secteur d'activité" },
  { id: "segment", label: "Segment" },
];

let optionsPromise: Promise<CohortOption[]> | null = null;
export function fetchCohortOptions(): Promise<CohortOption[]> {
  optionsPromise ??= fetch("/api/cohort-mappings")
    .then((r) => (r.ok ? r.json() : { mappings: [] }))
    .then((d) => {
      const mapped = (Array.isArray(d.mappings) ? d.mappings : []) as Array<{ key?: string; label?: string; api_name?: string; object?: string }>;
      const extras = mapped
        .filter((m) => m.key && m.label && (m.api_name ?? "").trim() && (!m.object || m.object === "companies"))
        .filter((m) => !BASE_COHORT_OPTIONS.some((o) => o.id === m.key))
        .map((m) => ({ id: m.key as string, label: m.label as string }));
      return [...BASE_COHORT_OPTIONS, ...extras];
    })
    .catch(() => BASE_COHORT_OPTIONS);
  return optionsPromise;
}

const valuesCache = new Map<string, Promise<string[]>>();
export function fetchCohortValues(key: string): Promise<string[]> {
  if (!valuesCache.has(key)) {
    valuesCache.set(
      key,
      fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Dimension cohort.<key> : mêmes règles de lecture que le filtre moteur.
        body: JSON.stringify({ query: { entity: "companies", groupBy: `cohort.${key}`, measure: "count" }, all: true, sources: [] }),
      })
        .then((r) => r.json())
        .then((d) => (Array.isArray(d.data) ? (d.data as { name: string }[]).map((r) => r.name).filter(Boolean) : []))
        .catch(() => []),
    );
  }
  return valuesCache.get(key)!;
}

const dealIdsCache = new Map<string, Promise<Set<string> | null>>();
/** Ids HubSpot des deals dont l'entreprise appartient à la cohorte (null = indisponible). */
export function fetchCohortDealIds(key: string, value: string): Promise<Set<string> | null> {
  const k = `${key}::${value}`;
  if (!dealIdsCache.has(k)) {
    dealIdsCache.set(
      k,
      fetch(`/api/reports/cohort-deals?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d && Array.isArray(d.dealIds) ? new Set(d.dealIds as string[]) : null))
        .catch(() => null),
    );
  }
  return dealIdsCache.get(k)!;
}
