/**
 * Santé du câblage d'un connecteur SUR MESURE — 1a du plan « tableaux
 * personnalisables ». Pour chaque entité canonique alimentée par le connecteur
 * (primary_source = custom_<clé>), on mesure la part des enregistrements
 * réellement RATTACHÉS à une entreprise (company_id résolu via custom_id).
 *
 * C'est LA limite honnête des KPIs croisés : un enregistrement non rattaché
 * est compté dans les agrégats mono-source mais invisible dans les croisements
 * par entreprise. Le funnel affiche cette couverture au choix de la source —
 * même philosophie que le gate de couverture du moteur de réconciliation :
 * un KPI honnête sur son périmètre vaut mieux qu'un KPI faux en silence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceCoverage = {
  entity: string;
  /** Libellé pluriel affiché (« factures », « tickets »…). */
  label: string;
  total: number;
  linked: number;
};

/** Tables canoniques porteuses de primary_source + company_id. */
const COVERAGE_TABLES: Array<{ entity: string; table: string; label: string }> = [
  { entity: "deals", table: "deals", label: "affaires" },
  { entity: "invoices", table: "invoices", label: "factures" },
  { entity: "subscriptions", table: "subscriptions", label: "abonnements" },
  { entity: "transactions", table: "bank_transactions", label: "transactions" },
  { entity: "tickets", table: "tickets", label: "tickets" },
];

/**
 * Couverture de rattachement d'un provider custom_* — uniquement les entités
 * où il a au moins un enregistrement. Coût borné : 2 comptages head par table.
 */
export async function customSourceCoverage(
  supabase: SupabaseClient,
  orgId: string,
  providerKey: string,
): Promise<SourceCoverage[]> {
  const out: SourceCoverage[] = [];
  await Promise.all(
    COVERAGE_TABLES.map(async ({ entity, table, label }) => {
      try {
        const [{ count: total }, { count: linked }] = await Promise.all([
          supabase
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("primary_source", providerKey),
          supabase
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("primary_source", providerKey)
            .not("company_id", "is", null),
        ]);
        if ((total ?? 0) > 0) out.push({ entity, label, total: total ?? 0, linked: linked ?? 0 });
      } catch {
        /* table/colonne absente → entité ignorée */
      }
    }),
  );
  // Ordre stable (celui du tableau de référence).
  return out.sort(
    (a, b) =>
      COVERAGE_TABLES.findIndex((t) => t.entity === a.entity) -
      COVERAGE_TABLES.findIndex((t) => t.entity === b.entity),
  );
}
