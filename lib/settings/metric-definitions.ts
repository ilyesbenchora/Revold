import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dictionnaire sémantique des métriques de l'organisation (Paramètres →
 * Métriques) : les définitions MAISON (« CA signé = deals gagnés hors
 * renouvellements ») injectées dans le system prompt de tous les agents —
 * chat des agents experts, tableaux conversationnels, câblage des KPIs
 * personnalisés. Une seule source de vérité du vocabulaire chiffré.
 */

export type MetricDefinition = {
  id: string;
  label: string;
  definition: string;
  unit: string | null;
};

const UNITS = new Set(["currency", "percent", "count"]);

export function isValidMetricUnit(u: unknown): u is string {
  return typeof u === "string" && UNITS.has(u);
}

/** Définitions de l'org — résilient (table absente → liste vide). */
export async function getMetricDefinitions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<MetricDefinition[]> {
  try {
    const { data, error } = await supabase
      .from("metric_definitions")
      .select("id, label, definition, unit")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(40);
    if (error) return [];
    return (data ?? []) as MetricDefinition[];
  } catch {
    return [];
  }
}

/**
 * Directive à APPENDRE au system prompt d'un agent : le vocabulaire chiffré de
 * l'entreprise, à respecter avant toute interprétation. Chaîne vide si aucune
 * définition.
 */
export async function metricDictionaryDirective(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const defs = await getMetricDefinitions(supabase, orgId);
  if (defs.length === 0) return "";
  const lines = defs.map(
    (d) => `- « ${d.label} »${d.unit ? ` (${d.unit === "currency" ? "€" : d.unit === "percent" ? "%" : "nombre"})` : ""} : ${d.definition}`,
  );
  return (
    "\n\nDICTIONNAIRE DES MÉTRIQUES DE L'ENTREPRISE (défini par l'utilisateur dans Paramètres → Métriques — " +
    "il FAIT FOI : quand une question ou un KPI emploie l'un de ces termes, applique CETTE définition, " +
    "notamment ses périmètres, exclusions et pipelines de référence, avant toute interprétation par défaut) :\n" +
    lines.join("\n")
  );
}
