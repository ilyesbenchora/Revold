import type { AggSpec } from "@/lib/alerts/agg-value";

const FORECAST_LABELS: Record<string, string> = {
  closing_rate: "Closing rate",
  pipeline_coverage: "Couverture pipeline",
  deal_activation: "Activation deals",
  pipeline_value: "Valeur pipeline",
  avg_deal_size: "Panier moyen",
  deals_at_risk: "Deals à risque",
  revenue_won: "CA signé",
  deals_count: "Deals créés",
  deals_won_count: "Deals gagnés",
  stagnant_deals: "Deals stagnants",
  conversion_rate: "Taux de conversion",
  orphan_rate: "Taux d'orphelins",
  phone_enrichment: "Enrichissement tél.",
  dormant_reactivation: "Contacts dormants",
  weighted_pipeline: "Pipeline pondéré",
  sales_cycle_days: "Cycle de vente",
  deals_no_amount: "Deals sans montant",
  data_completeness: "Complétude deals",
  mql_to_sql_rate: "MQL→SQL",
  contacts_by_source: "Contacts par source",
  source_to_lifecycle: "Source → lifecycle",
  source_to_deal_created: "Source → deal créé",
  source_to_deal_won: "Source → deal gagné",
};

const ENTITY_LABELS: Record<string, string> = {
  deals: "deals", invoices: "factures", subscriptions: "abonnements",
  tickets: "tickets", companies: "entreprises", contacts: "contacts",
};

/**
 * Libellé court « à quelle donnée réelle ce KPI est rattaché », pour le badge de
 * transparence sur les cartes d'alertes / objectifs. Renvoie null si non câblé.
 */
export function trackingLabel(forecastType?: string | null, aggSpec?: AggSpec | null): string | null {
  if (forecastType) return FORECAST_LABELS[forecastType] ?? forecastType;
  if (aggSpec && aggSpec.entity) {
    // Cas spéciaux lisibles.
    if (aggSpec.entity === "subscriptions" && aggSpec.field === "mrr" && aggSpec.multiplier === 12) return "ARR (abonnements actifs × 12)";
    if (aggSpec.entity === "subscriptions" && aggSpec.field === "mrr") return "MRR (abonnements)";
    if (aggSpec.entity === "invoices" && aggSpec.field === "amount_paid") return "CA encaissé (factures)";
    const ent = ENTITY_LABELS[aggSpec.entity] ?? aggSpec.entity;
    const meas = aggSpec.measure === "sum" ? `somme ${aggSpec.field ?? ""}`.trim()
      : aggSpec.measure === "avg" ? `moyenne ${aggSpec.field ?? ""}`.trim()
      : "nombre";
    const mult = aggSpec.multiplier && aggSpec.multiplier !== 1 ? ` ×${aggSpec.multiplier}` : "";
    const tgt = aggSpec.target && aggSpec.target !== "Total" ? ` · ${aggSpec.target}` : "";
    return `${ent} · ${meas}${mult}${tgt}`;
  }
  return null;
}
