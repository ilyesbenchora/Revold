// Suggestions de tuiles KPI par page — mêmes KPIs que l'étape KPI du
// formulaire de création d'alerte (kpisByTeam → forecast_type résolu par
// resolveKpiValue), complétées par des KPIs facturation/support déterministes
// (agg_spec résolu par valueFromAggSpec). Chaque page propose les KPIs de son
// pôle, filtrés côté client selon les outils réellement connectés.

import { kpisByTeam, type KpiDef } from "@/lib/alerts/kpi-catalog";
import type { AggSpec } from "@/lib/alerts/agg-value";
import type { ConnectableTool } from "@/lib/integrations/connect-catalog";

export type TileUnit = "percent" | "currency" | "count";

export type TileSuggestion = {
  id: string;
  label: string;
  description: string;
  unit: TileUnit;
  /** Catégorie d'outil requise — filtre par outils connectés (comme les presets de tables). */
  sourceCategory: ConnectableTool["category"];
  /** Voie resolveKpiValue (id du catalogue d'alertes). */
  forecastType?: string;
  /** Voie valueFromAggSpec (agrégat canonique déterministe). */
  aggSpec?: AggSpec;
};

function fromKpiDefs(defs: KpiDef[]): TileSuggestion[] {
  return defs.map((k) => ({
    id: k.id,
    label: k.label,
    description: k.description,
    unit: k.defaultUnit,
    sourceCategory: "crm",
    forecastType: k.id,
  }));
}

// ── KPIs facturation / trésorerie (agrégats canoniques, cross-outils) ──
const BILLING_TILES: TileSuggestion[] = [
  { id: "mrr_active", label: "MRR actif", description: "Revenu mensuel récurrent des abonnements actifs", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active" } },
  { id: "arr_active", label: "ARR", description: "Revenu annuel récurrent (MRR actif × 12)", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active", multiplier: 12 } },
  { id: "ca_encaisse", label: "CA encaissé", description: "Montant total réellement encaissé sur les factures", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" } },
  { id: "ca_facture", label: "Montant facturé", description: "Montant total des factures émises", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" } },
  { id: "impayes", label: "Impayés (créances)", description: "Reste dû cumulé sur les factures non soldées", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due" } },
  { id: "factures_emises", label: "Factures émises", description: "Nombre total de factures émises", unit: "count", sourceCategory: "billing", aggSpec: { entity: "invoices", groupBy: "status", measure: "count" } },
  { id: "encaissements", label: "Encaissements", description: "Flux bancaires entrants synchronisés (TTC)", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_in" } },
  { id: "decaissements", label: "Décaissements", description: "Flux bancaires sortants synchronisés (TTC)", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_out" } },
  { id: "flux_net", label: "Flux net", description: "Encaissements − décaissements sur les transactions synchronisées", unit: "currency", sourceCategory: "billing", aggSpec: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount" } },
];

// ── KPIs support / rétention (agrégats canoniques) ──
const SUPPORT_TILES: TileSuggestion[] = [
  { id: "tickets_total", label: "Tickets (total)", description: "Volume total de tickets synchronisés", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "count" } },
  { id: "subs_actives", label: "Abonnements actifs", description: "Nombre d'abonnements en cours", unit: "count", sourceCategory: "billing", aggSpec: { entity: "subscriptions", groupBy: "status", measure: "count", target: "active" } },
];

/** Équipe d'alerte associée aux tuiles de chaque page (KPI personnalisé + création d'alerte). */
export const PAGE_TILE_TEAM: Record<string, string> = {
  perf_ventes: "sales",
  perf_marketing: "marketing",
  audit_paiement_facturation: "revops",
  audit_service_client: "cs",
  audit_adoption: "revops",
  audit_donnees: "ops",
};

const PAGE_TILE_SUGGESTIONS: Record<string, TileSuggestion[]> = {
  perf_ventes: fromKpiDefs(kpisByTeam.sales),
  perf_marketing: fromKpiDefs(kpisByTeam.marketing),
  audit_paiement_facturation: [
    ...BILLING_TILES,
    ...fromKpiDefs(kpisByTeam.revops.filter((k) => ["revenue_won", "weighted_pipeline", "pipeline_value", "closing_rate"].includes(k.id))),
  ],
  audit_service_client: [
    ...fromKpiDefs(kpisByTeam.cs),
    ...SUPPORT_TILES,
  ],
  audit_adoption: [
    ...fromKpiDefs(kpisByTeam.sales.filter((k) => ["pipeline_coverage", "deal_activation", "stagnant_deals", "sales_cycle_days"].includes(k.id))),
    ...fromKpiDefs(kpisByTeam.revops.filter((k) => ["deals_won_count"].includes(k.id))),
    // data_completeness vit dans le pôle data (ops) depuis le recentrage Finance.
    ...fromKpiDefs(kpisByTeam.ops.filter((k) => ["data_completeness"].includes(k.id))),
  ],
  audit_donnees: fromKpiDefs(kpisByTeam.ops),
};

/**
 * Catalogue COMPLET des suggestions de KPI, toutes équipes confondues —
 * alimente la liste exhaustive du bloc héro de la home (« ＋ Plus de KPIs »).
 * Dédupliqué par id, chaque entrée porte son équipe d'origine.
 */
export function allTileSuggestions(): (TileSuggestion & { team: string })[] {
  const groups: [string, TileSuggestion[]][] = [
    ["sales", fromKpiDefs(kpisByTeam.sales)],
    ["marketing", fromKpiDefs(kpisByTeam.marketing)],
    ["cs", fromKpiDefs(kpisByTeam.cs)],
    ["revops", fromKpiDefs(kpisByTeam.revops)],
    ["ops", fromKpiDefs(kpisByTeam.ops)],
    ["billing", BILLING_TILES],
    ["support", SUPPORT_TILES],
  ];
  const seen = new Set<string>();
  const out: (TileSuggestion & { team: string })[] = [];
  for (const [team, list] of groups) {
    for (const s of list) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({ ...s, team });
    }
  }
  return out;
}

export function tileSuggestionsForPage(pageKey: string): TileSuggestion[] {
  // Dédupliqué par id : pipeline_coverage / deal_activation existent dans sales ET revops.
  const seen = new Set<string>();
  return (PAGE_TILE_SUGGESTIONS[pageKey] ?? []).filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}
