/**
 * Filtre cohorte côté CLIENT — helpers partagés par les blocs de rapport
 * (BlockDataTable, Deals à risque, Forecast management…) : options (standard +
 * cohortes mappées de Paramètres → Cohortes, objet Company), valeurs
 * distinctes, et ids HubSpot des deals dont l'entreprise appartient à la
 * cohorte. Tout est mis en cache au niveau module (une page = un fetch).
 */

export type CohortOption = { id: string; label: string; object: "companies" | "contacts" | "deals" };
export type ActiveCohort = { key: string; value: string };

let optionsPromise: Promise<CohortOption[]> | null = null;
/**
 * Cohortes filtrables = TOUTES celles enregistrées dans Paramètres → Cohortes
 * (propriété mappée, quel que soit l'objet : Entreprise, Contact, Deal — miroir
 * exact de la page Paramètres), dans le PÉRIMÈTRE DU MEMBRE : celles de son
 * équipe + celles de « Toutes les équipes » (scope=filters, filtré côté
 * serveur). Si rien n'est visible, les sélecteurs se masquent.
 */
export function fetchCohortOptions(): Promise<CohortOption[]> {
  optionsPromise ??= fetch("/api/cohort-mappings?scope=filters")
    .then((r) => (r.ok ? r.json() : { mappings: [] }))
    .then((d) => {
      const mapped = (Array.isArray(d.mappings) ? d.mappings : []) as Array<{ key?: string; label?: string; api_name?: string; object?: string }>;
      return mapped
        .filter((m) => m.key && m.label && (m.api_name ?? "").trim())
        .map((m) => ({
          id: m.key as string,
          label: m.label as string,
          object: (m.object === "contacts" || m.object === "deals" ? m.object : "companies") as CohortOption["object"],
        }));
    })
    .catch(() => [] as CohortOption[]);
  return optionsPromise;
}

const valuesCache = new Map<string, Promise<string[]>>();
export function fetchCohortValues(key: string): Promise<string[]> {
  if (!valuesCache.has(key)) {
    valuesCache.set(
      key,
      // Les valeurs se lisent sur l'objet PORTEUR de la cohorte (raw_data de
      // companies / contacts / deals) — mêmes règles que le filtre moteur.
      fetchCohortOptions()
        .then((opts) => opts.find((o) => o.id === key)?.object ?? "companies")
        .then((object) =>
          fetch("/api/reports/recompute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: { entity: object, groupBy: `cohort.${key}`, measure: "count" }, all: true, sources: [] }),
          }),
        )
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
