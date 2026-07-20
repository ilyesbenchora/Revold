// Presets de « tables de données » proposés par page (les KPIs dynamiques du
// funnel). Chaque preset se traduit directement en spec agrégée déterministe
// (entité + dimension + mesure) réutilisée par /api/reports/recompute.

import type { ConnectableTool } from "@/lib/integrations/connect-catalog";

export type TableView = "table" | "bar" | "line" | "donut";
// « weighted » = somme du champ pondérée par la probabilité de closing (deals HubSpot).
export type TableMeasure = "count" | "sum" | "avg" | "weighted";
export type TableUnit = "count" | "currency" | "percent";

export type TablePreset = {
  id: string;
  label: string;
  entity: string;
  groupBy: string;
  measure: TableMeasure;
  field?: string;
  unit: TableUnit;
  view?: TableView;
  /**
   * Outil précis exigé pour ce KPI (ex : « hubspot » pour la projection pondérée,
   * qui a besoin de la probabilité de closing propre à HubSpot). Si absent, le KPI
   * est proposé dès qu'un outil de la catégorie source de l'entité est connecté.
   */
  requiresKey?: string;
};

// Catégorie d'outil qui alimente chaque entité canonique. Le funnel de création
// de table s'en sert pour filtrer dynamiquement les KPIs proposés selon les
// outils réellement connectés (« données à croiser » choisies avant le KPI).
export const ENTITY_SOURCE_CATEGORY: Record<string, ConnectableTool["category"]> = {
  deals: "crm",
  contacts: "crm",
  companies: "crm",
  invoices: "billing",
  subscriptions: "billing",
  tickets: "support",
  // Pseudo-entité « fiscal » : échéances TVA/IS/URSSAF, rattachées au pôle
  // facturation/compta (donc proposées dès qu'un outil billing est connecté).
  fiscal: "billing",
};

// Dimensions disponibles par entité → le paramètre « Grouper par » façon Notion.
export const ENTITY_DIMS: Record<string, { id: string; label: string }[]> = {
  deals: [
    { id: "stage", label: "Étape du pipeline" },
    { id: "month_created", label: "Mois de création" },
    { id: "month_closed", label: "Mois de closing" },
  ],
  invoices: [
    { id: "status", label: "Statut" },
    { id: "source", label: "Source" },
    { id: "month_issued", label: "Mois d'émission" },
    { id: "month_paid", label: "Mois de paiement" },
  ],
  subscriptions: [
    { id: "status", label: "Statut" },
    { id: "source", label: "Source" },
    { id: "month_started", label: "Mois de début" },
    { id: "month_canceled", label: "Mois d'annulation" },
  ],
  tickets: [{ id: "status", label: "Statut" }],
  contacts: [
    { id: "mql", label: "MQL" },
    { id: "sql", label: "SQL" },
  ],
  companies: [
    { id: "segment", label: "Segment" },
    { id: "industry", label: "Industrie" },
    { id: "country", label: "Pays" },
  ],
};

export const PAGE_LABELS: Record<string, string> = {
  perf_ventes: "Ventes",
  perf_marketing: "Marketing",
  audit_automatisations: "Automatisations",
  audit_service_client: "Service client",
  audit_paiement_facturation: "Trésorerie",
};

export const TABLE_PRESETS: Record<string, TablePreset[]> = {
  perf_ventes: [
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Montant du pipeline par étape", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
    { id: "revenue_month", label: "CA signé par mois", entity: "deals", groupBy: "month_closed", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "avg_amount_stage", label: "Montant moyen par étape", entity: "deals", groupBy: "stage", measure: "avg", field: "amount", unit: "currency", view: "bar" },
    { id: "deals_closed_month", label: "Deals fermés par mois", entity: "deals", groupBy: "month_closed", measure: "count", unit: "count", view: "line" },
    { id: "avg_amount_month", label: "Panier moyen signé par mois", entity: "deals", groupBy: "month_closed", measure: "avg", field: "amount", unit: "currency", view: "line" },
  ],
  perf_marketing: [
    { id: "contacts_mql", label: "Contacts MQL / non-MQL", entity: "contacts", groupBy: "mql", measure: "count", unit: "count", view: "donut" },
    { id: "contacts_sql", label: "Contacts SQL / non-SQL", entity: "contacts", groupBy: "sql", measure: "count", unit: "count", view: "donut" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "pipeline_created_month", label: "Pipeline créé par mois (montant)", entity: "deals", groupBy: "month_created", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Pipeline par étape (montant)", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
  ],
  audit_automatisations: [
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "tickets_status", label: "Tickets par statut", entity: "tickets", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Montant du pipeline par étape", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
    { id: "deals_closed_month", label: "Deals fermés par mois", entity: "deals", groupBy: "month_closed", measure: "count", unit: "count", view: "line" },
    { id: "pipeline_created_month", label: "Pipeline créé par mois (montant)", entity: "deals", groupBy: "month_created", measure: "sum", field: "amount", unit: "currency", view: "line" },
  ],
  audit_service_client: [
    { id: "tickets_status", label: "Tickets par statut", entity: "tickets", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "mrr_status", label: "MRR par statut d'abonnement", entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" },
    { id: "subs_status", label: "Abonnements par statut", entity: "subscriptions", groupBy: "status", measure: "count", unit: "count", view: "donut" },
    { id: "subs_canceled_month", label: "Abonnements annulés par mois", entity: "subscriptions", groupBy: "month_canceled", measure: "count", unit: "count", view: "line" },
  ],
  audit_paiement_facturation: [
    // ── HubSpot : projection pondérée du pipeline (probabilité de closing HubSpot) ──
    { id: "weighted_forecast_stage", label: "Projection pondérée des transactions gagnées", entity: "deals", groupBy: "stage", measure: "weighted", field: "amount", unit: "currency", view: "bar", requiresKey: "hubspot" },
    // ── Stripe / compta : factures, créances (impayés) et cash réel encaissé ──
    { id: "invoices_status", label: "Factures par statut", entity: "invoices", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "invoiced_month", label: "Montant facturé par mois", entity: "invoices", groupBy: "month_issued", measure: "sum", field: "amount_total", unit: "currency", view: "line" },
    { id: "receivables_status", label: "Créances (impayés) par statut", entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due", unit: "currency", view: "bar" },
    { id: "real_cash_month", label: "Cash réel encaissé par mois", entity: "invoices", groupBy: "month_paid", measure: "sum", field: "amount_paid", unit: "currency", view: "line" },
    // ── Échéances fiscales (config dans Paramètres → Organisation) ──
    { id: "fiscal_echeances", label: "Échéances fiscales (TVA · IS · URSSAF)", entity: "fiscal", groupBy: "echeance", measure: "sum", field: "montant", unit: "currency", view: "table" },
    // ── Abonnements / MRR ──
    { id: "mrr_status", label: "MRR par statut d'abonnement", entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" },
    { id: "subs_started_month", label: "Abonnements démarrés par mois", entity: "subscriptions", groupBy: "month_started", measure: "count", unit: "count", view: "line" },
    { id: "mrr_canceled_month", label: "MRR annulé par mois", entity: "subscriptions", groupBy: "month_canceled", measure: "sum", field: "mrr", unit: "currency", view: "line" },
  ],
};

/** Agent (persona) responsable de la création de KPIs personnalisés, par page. */
export const PAGE_AGENT_KEY: Record<string, string> = {
  perf_ventes: "performance",
  perf_marketing: "coaching-marketing",
  audit_automatisations: "automatisations",
  audit_service_client: "service-client",
  audit_paiement_facturation: "paiement-facturation",
};

export function presetsForPage(pageKey: string): TablePreset[] {
  return TABLE_PRESETS[pageKey] ?? [];
}

/** Un outil connecté, tel que renvoyé par /api/integrations/connected. */
export type SourceTool = {
  key: string;
  category: ConnectableTool["category"];
  label: string;
  icon: string;
};

/** Catégorie source d'un preset, dérivée de son entité canonique. */
export function presetSourceCategory(p: TablePreset): ConnectableTool["category"] | null {
  return ENTITY_SOURCE_CATEGORY[p.entity] ?? null;
}

/**
 * Filtre les KPIs d'une page selon les sources sélectionnées dans le funnel.
 * Un KPI est proposé si :
 *   - un outil sélectionné appartient à la catégorie source de son entité, ET
 *   - si le KPI exige un outil précis (requiresKey), cet outil est sélectionné.
 * Sans sélection, on renvoie tous les KPIs de la page (comportement historique).
 */
export function filterPresetsBySources(
  presets: TablePreset[],
  selected: SourceTool[],
): TablePreset[] {
  if (selected.length === 0) return presets;
  const selectedKeys = new Set(selected.map((t) => t.key));
  const selectedCats = new Set(selected.map((t) => t.category));
  return presets.filter((p) => {
    if (p.requiresKey && !selectedKeys.has(p.requiresKey)) return false;
    const cat = presetSourceCategory(p);
    if (!cat) return true; // entité sans source connue → toujours proposée
    return selectedCats.has(cat);
  });
}
