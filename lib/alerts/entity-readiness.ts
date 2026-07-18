import type { SupabaseClient } from "@supabase/supabase-js";
import type { AggSpec } from "@/lib/alerts/agg-value";

// Entités canoniques susceptibles d'alimenter un KPI (tables synchronisées).
const CANONICAL_ENTITIES = ["deals", "invoices", "subscriptions", "tickets", "companies", "contacts"] as const;

// KPI catalogué → entité source principale (pour juger si la donnée est enrichie).
const FORECAST_ENTITY: Record<string, string> = {
  closing_rate: "deals", pipeline_coverage: "deals", deal_activation: "deals", pipeline_value: "deals",
  avg_deal_size: "deals", deals_at_risk: "deals", revenue_won: "deals", deals_count: "deals",
  deals_won_count: "deals", stagnant_deals: "deals", weighted_pipeline: "deals", sales_cycle_days: "deals",
  deals_no_amount: "deals", data_completeness: "deals",
  conversion_rate: "contacts", orphan_rate: "contacts", phone_enrichment: "contacts", dormant_reactivation: "contacts",
  mql_to_sql_rate: "contacts", contacts_by_source: "contacts", source_to_lifecycle: "contacts",
  source_to_deal_created: "contacts", source_to_deal_won: "contacts",
};

/** Ensemble des entités canoniques qui ont RÉELLEMENT des données pour l'org. */
export async function loadEntitiesWithData(supabase: SupabaseClient, orgId: string): Promise<Set<string>> {
  const set = new Set<string>();
  await Promise.all(
    CANONICAL_ENTITIES.map(async (e) => {
      try {
        const { count } = await supabase.from(e).select("*", { count: "exact", head: true }).eq("organization_id", orgId);
        if ((count ?? 0) > 0) set.add(e);
      } catch {
        /* table absente / non accessible → considérée vide */
      }
    }),
  );
  return set;
}

/**
 * Le KPI est-il rattaché à une donnée RÉELLEMENT enrichie ? true si l'entité
 * source a des lignes ; false si vide (câblage ok mais source non synchronisée) ;
 * undefined si on ne sait pas rattacher une entité (pas de signal → pas d'alarme).
 */
export function isKpiDataReady(
  readySet: Set<string>,
  forecastType?: string | null,
  aggSpec?: AggSpec | null,
): boolean | undefined {
  const entity = aggSpec?.entity ?? (forecastType ? FORECAST_ENTITY[forecastType] : undefined);
  if (!entity) return undefined;
  return readySet.has(entity);
}
