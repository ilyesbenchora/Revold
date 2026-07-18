// Presets de « tables de données » proposés par page (les KPIs dynamiques du
// funnel). Chaque preset se traduit directement en spec agrégée déterministe
// (entité + dimension + mesure) réutilisée par /api/reports/recompute.

export type TableView = "table" | "bar" | "line" | "donut";
export type TableMeasure = "count" | "sum" | "avg";
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
  audit_paiement_facturation: "Paiement & facturation",
};

export const TABLE_PRESETS: Record<string, TablePreset[]> = {
  perf_ventes: [
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Montant du pipeline par étape", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
    { id: "revenue_month", label: "CA signé par mois", entity: "deals", groupBy: "month_closed", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
  ],
  perf_marketing: [
    { id: "contacts_mql", label: "Contacts MQL / non-MQL", entity: "contacts", groupBy: "mql", measure: "count", unit: "count", view: "donut" },
    { id: "contacts_sql", label: "Contacts SQL / non-SQL", entity: "contacts", groupBy: "sql", measure: "count", unit: "count", view: "donut" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
  ],
  audit_automatisations: [
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "deals_created_month", label: "Deals créés par mois", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "tickets_status", label: "Tickets par statut", entity: "tickets", groupBy: "status", measure: "count", unit: "count", view: "bar" },
  ],
  audit_service_client: [
    { id: "tickets_status", label: "Tickets par statut", entity: "tickets", groupBy: "status", measure: "count", unit: "count", view: "bar" },
  ],
  audit_paiement_facturation: [
    { id: "invoices_status", label: "Factures par statut", entity: "invoices", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "invoiced_month", label: "Montant facturé par mois", entity: "invoices", groupBy: "month_issued", measure: "sum", field: "amount_total", unit: "currency", view: "line" },
    { id: "mrr_status", label: "MRR par statut d'abonnement", entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" },
    { id: "subs_started_month", label: "Abonnements démarrés par mois", entity: "subscriptions", groupBy: "month_started", measure: "count", unit: "count", view: "line" },
  ],
};

export function presetsForPage(pageKey: string): TablePreset[] {
  return TABLE_PRESETS[pageKey] ?? [];
}
