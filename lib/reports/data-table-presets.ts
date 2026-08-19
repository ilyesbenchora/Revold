// Presets de « tables de données » proposés par page (les KPIs dynamiques du
// funnel). Chaque preset se traduit directement en spec agrégée déterministe
// (entité + dimension + mesure) réutilisée par /api/reports/recompute.

import type { ConnectableTool } from "@/lib/integrations/connect-catalog";

export type TableView = "table" | "bar" | "line" | "donut" | "bloc";
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
  /**
   * Catégories d'outils TOUTES requises dans la sélection (ex : ["crm",
   * "billing"] pour un délai croisé deal × facture). Complète la catégorie de
   * l'entité pour les KPIs réconciliés multi-sources.
   */
  requiresCategories?: ConnectableTool["category"][];
  /**
   * KPI résolu par resolveKpiValue (recette réconciliée, délai médian…) au lieu
   * d'un agrégat entité × dimension. Toujours tuile uniquement (pas de lignes).
   */
  forecastType?: string;
  /** Proposé uniquement comme TUILE (pas de table/graphique — valeur unique). */
  tileOnly?: boolean;
  /**
   * Ligne du regroupement isolée par la tuile (ex : « Gagnés » sur le
   * regroupement outcome) — la valeur est celle de CETTE ligne, pas le total.
   */
  target?: string;
  /** Avec target : la tuile affiche 100 × ligne cible / total (taux). */
  percentOfTotal?: boolean;
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
  transactions: "billing",
  tickets: "support",
  // Pseudo-entité « fiscal » : échéances TVA/IS/URSSAF, rattachées au pôle
  // facturation/compta (donc proposées dès qu'un outil billing est connecté).
  fiscal: "billing",
};

// Dimensions disponibles par entité → le paramètre « Grouper par » façon Notion.
// Les dimensions temporelles (id month_*) sont libellées « Date de … » : la
// granularité de l'axe (jour, semaine, mois…) est choisie via « Fréquence ».
export const ENTITY_DIMS: Record<string, { id: string; label: string }[]> = {
  deals: [
    { id: "stage", label: "Étape du pipeline" },
    { id: "status", label: "Statut (en cours / gagné / perdu)" },
    { id: "outcome", label: "Résultat des deals clôturés (gagné / perdu)" },
    { id: "close_date_state", label: "Close date (à jour / dépassée)" },
    { id: "month_created", label: "Date de création" },
    { id: "month_closed", label: "Date de closing" },
  ],
  invoices: [
    { id: "status", label: "Statut" },
    { id: "source", label: "Source" },
    { id: "month_issued", label: "Date d'émission" },
    { id: "month_paid", label: "Date de paiement" },
  ],
  subscriptions: [
    { id: "status", label: "Statut" },
    { id: "source", label: "Source" },
    { id: "month_started", label: "Date de début" },
    { id: "month_canceled", label: "Date d'annulation" },
  ],
  transactions: [
    { id: "month_transaction", label: "Date de transaction" },
    { id: "direction", label: "Sens (encaissement / décaissement)" },
    { id: "category", label: "Catégorie" },
    { id: "source", label: "Source" },
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

// Libellés humains des entités canoniques — sous-titres de cartes, funnel, alertes.
export const ENTITY_LABELS: Record<string, string> = {
  deals: "Deals",
  contacts: "Contacts",
  companies: "Entreprises",
  invoices: "Factures",
  subscriptions: "Abonnements",
  transactions: "Transactions bancaires",
  tickets: "Tickets",
  fiscal: "Échéances fiscales",
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

/** Libellé humain d'une dimension (« month_created » → « Mois de création »). */
export function dimLabel(entity: string, dim: string): string {
  return ENTITY_DIMS[entity]?.find((d) => d.id === dim)?.label ?? dim;
}

/**
 * Champs numériques agrégeables par entité, avec libellés humains — alimente le
 * sélecteur « Mesure » de l'étape Vérification (tables, alertes, objectifs) :
 * l'utilisateur corrige lui-même le champ quand son KPI est ambigu
 * (ex : encaissements vs flux net sur les transactions bancaires).
 */
export const ENTITY_FIELDS: Record<string, { id: string; label: string; unit: TableUnit }[]> = {
  deals: [{ id: "amount", label: "montant des deals", unit: "currency" }],
  invoices: [
    { id: "amount_total", label: "montant total facturé", unit: "currency" },
    { id: "amount_paid", label: "montant encaissé", unit: "currency" },
    { id: "amount_due", label: "reste dû (impayés)", unit: "currency" },
  ],
  subscriptions: [{ id: "mrr", label: "MRR", unit: "currency" }],
  transactions: [
    { id: "amount_in", label: "encaissements (entrées)", unit: "currency" },
    { id: "amount_out", label: "décaissements (sorties)", unit: "currency" },
    { id: "amount", label: "flux net (encaissements − décaissements)", unit: "currency" },
  ],
};

export function fieldLabel(entity: string, field: string | null): string {
  if (!field) return "valeur";
  return ENTITY_FIELDS[entity]?.find((f) => f.id === field)?.label ?? field;
}

export const PAGE_LABELS: Record<string, string> = {
  perf_ventes: "Ventes",
  perf_marketing: "Marketing",
  audit_service_client: "Service client",
  audit_paiement_facturation: "Trésorerie",
  audit_donnees: "Rapprochement données",
};

// AUCUNE période / fréquence dans les libellés : la granularité temporelle
// (jour, semaine, mois…) et la période d'analyse se choisissent aux étapes
// suivantes (« Fréquence » + « Période » de la table). Les dimensions month_*
// signifient seulement « évolution dans le temps ».
export const TABLE_PRESETS: Record<string, TablePreset[]> = {
  perf_ventes: [
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Montant du pipeline par étape", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
    { id: "weighted_forecast_stage", label: "Répartition du CA pondéré par étape (par pipeline)", entity: "deals", groupBy: "stage", measure: "weighted", field: "amount", unit: "currency", view: "bar", requiresKey: "hubspot" },
    // ── Tuiles ciblées PAR PIPELINE : le pipeline se choisit à l'étape
    //    Affichage et la tuile est calculée uniquement sur celui-ci. Les
    //    targets reprennent les libellés des dims status/outcome/close_date_state.
    { id: "pipeline_weighted_amount", label: "Montant pondéré des deals en cours (par pipeline)", entity: "deals", groupBy: "status", measure: "weighted", field: "amount", unit: "currency", view: "bloc", requiresKey: "hubspot", target: "En cours", tileOnly: true },
    { id: "pipeline_open_amount", label: "Montant des deals en cours (par pipeline)", entity: "deals", groupBy: "status", measure: "sum", field: "amount", unit: "currency", view: "bloc", target: "En cours", tileOnly: true },
    { id: "pipeline_won_amount", label: "CA signé (par pipeline)", entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", unit: "currency", view: "bloc", target: "Gagnés", tileOnly: true },
    { id: "pipeline_lost_amount", label: "Montant des deals perdus (par pipeline)", entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", unit: "currency", view: "bloc", target: "Perdus", tileOnly: true },
    { id: "pipeline_loss_rate", label: "Taux de perte (par pipeline)", entity: "deals", groupBy: "outcome", measure: "count", unit: "percent", view: "bloc", target: "Perdus", percentOfTotal: true, tileOnly: true },
    { id: "pipeline_close_date_overdue", label: "% de close dates dépassées (par pipeline)", entity: "deals", groupBy: "close_date_state", measure: "count", unit: "percent", view: "bloc", target: "Dépassée", percentOfTotal: true, tileOnly: true },
    { id: "avg_amount_stage", label: "Montant moyen par étape", entity: "deals", groupBy: "stage", measure: "avg", field: "amount", unit: "currency", view: "bar" },
    { id: "revenue_month", label: "Évolution du CA signé", entity: "deals", groupBy: "month_closed", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "deals_created_month", label: "Évolution des deals créés", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "deals_closed_month", label: "Évolution des deals fermés", entity: "deals", groupBy: "month_closed", measure: "count", unit: "count", view: "line" },
    { id: "avg_amount_month", label: "Évolution du panier moyen signé", entity: "deals", groupBy: "month_closed", measure: "avg", field: "amount", unit: "currency", view: "line" },
    { id: "pipeline_created_month", label: "Évolution du pipeline créé (montant)", entity: "deals", groupBy: "month_created", measure: "sum", field: "amount", unit: "currency", view: "line" },
  ],
  perf_marketing: [
    { id: "contacts_mql", label: "Contacts MQL / non-MQL", entity: "contacts", groupBy: "mql", measure: "count", unit: "count", view: "donut" },
    { id: "contacts_sql", label: "Contacts SQL / non-SQL", entity: "contacts", groupBy: "sql", measure: "count", unit: "count", view: "donut" },
    { id: "deals_created_month", label: "Évolution des deals créés", entity: "deals", groupBy: "month_created", measure: "count", unit: "count", view: "line" },
    { id: "pipeline_created_month", label: "Évolution du pipeline créé (montant)", entity: "deals", groupBy: "month_created", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "deals_stage", label: "Deals par étape", entity: "deals", groupBy: "stage", measure: "count", unit: "count", view: "bar" },
    { id: "pipeline_stage", label: "Pipeline par étape (montant)", entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" },
    { id: "companies_segment", label: "Entreprises par segment", entity: "companies", groupBy: "segment", measure: "count", unit: "count", view: "bar" },
    { id: "companies_industry", label: "Entreprises par industrie", entity: "companies", groupBy: "industry", measure: "count", unit: "count", view: "bar" },
    { id: "companies_country", label: "Entreprises par pays", entity: "companies", groupBy: "country", measure: "count", unit: "count", view: "bar" },
  ],
  audit_service_client: [
    { id: "tickets_status", label: "Tickets par statut", entity: "tickets", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "mrr_status", label: "MRR par statut d'abonnement", entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" },
    { id: "subs_status", label: "Abonnements par statut", entity: "subscriptions", groupBy: "status", measure: "count", unit: "count", view: "donut" },
    { id: "subs_canceled_month", label: "Évolution des abonnements annulés", entity: "subscriptions", groupBy: "month_canceled", measure: "count", unit: "count", view: "line" },
    // Churn MRR + dynamique d'acquisition d'abonnements
    { id: "mrr_canceled_month", label: "Évolution du MRR annulé (churn)", entity: "subscriptions", groupBy: "month_canceled", measure: "sum", field: "mrr", unit: "currency", view: "line" },
    { id: "subs_started_month", label: "Évolution des abonnements démarrés", entity: "subscriptions", groupBy: "month_started", measure: "count", unit: "count", view: "line" },
    { id: "subs_source", label: "Abonnements par source", entity: "subscriptions", groupBy: "source", measure: "count", unit: "count", view: "donut" },
  ],
  audit_paiement_facturation: [
    // ── HubSpot : projection pondérée du pipeline (probabilité de closing HubSpot) ──
    { id: "weighted_forecast_stage", label: "Projection pondérée des transactions gagnées", entity: "deals", groupBy: "stage", measure: "weighted", field: "amount", unit: "currency", view: "bar", requiresKey: "hubspot" },
    // ── Transactions bancaires (Pennylane & co) : paiements réels, même sans facture ──
    { id: "tx_in_month", label: "Évolution des encaissements (transactions)", entity: "transactions", groupBy: "month_transaction", measure: "sum", field: "amount_in", unit: "currency", view: "line" },
    { id: "tx_out_month", label: "Évolution des décaissements (transactions)", entity: "transactions", groupBy: "month_transaction", measure: "sum", field: "amount_out", unit: "currency", view: "line" },
    { id: "tx_net_month", label: "Évolution du flux net (encaissements − décaissements)", entity: "transactions", groupBy: "month_transaction", measure: "sum", field: "amount", unit: "currency", view: "line" },
    { id: "tx_out_category", label: "Dépenses par catégorie", entity: "transactions", groupBy: "category", measure: "sum", field: "amount_out", unit: "currency", view: "bar" },
    // ── Stripe / compta : factures, créances (impayés) et cash réel encaissé ──
    { id: "invoices_status", label: "Factures par statut", entity: "invoices", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "invoiced_month", label: "Évolution du montant facturé", entity: "invoices", groupBy: "month_issued", measure: "sum", field: "amount_total", unit: "currency", view: "line" },
    { id: "receivables_status", label: "Créances (impayés) par statut", entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due", unit: "currency", view: "bar" },
    { id: "real_cash_month", label: "Évolution du cash réel encaissé", entity: "invoices", groupBy: "month_paid", measure: "sum", field: "amount_paid", unit: "currency", view: "line" },
    { id: "invoices_source", label: "Factures par source", entity: "invoices", groupBy: "source", measure: "count", unit: "count", view: "donut" },
    // ── Radar de facturation : factures attendues (rythme observé dans la
    //    facturation / fin de contrat CRM) non émises — l'amont du recouvrement ──
    { id: "billing_radar_overdue", label: "Factures attendues en retard", entity: "invoices", groupBy: "recon", measure: "count", unit: "count", view: "bloc", forecastType: "billing_radar_overdue", tileOnly: true },
    { id: "won_unbilled_count", label: "Deals gagnés sans facture", entity: "deals", groupBy: "recon", measure: "count", unit: "count", view: "bloc", forecastType: "won_unbilled_count", tileOnly: true, requiresCategories: ["crm", "billing"] },
    // ── Relais inter-services (ex-tuiles Alignement) : délais médians mesurés
    //    par le moteur de réconciliation (jointures réelles CRM × facturation) ──
    { id: "deal_won_to_first_invoice", label: "Deal gagné → 1re facture (délai médian)", entity: "deals", groupBy: "recon", measure: "count", unit: "count", view: "bloc", forecastType: "deal_won_to_first_invoice", tileOnly: true, requiresCategories: ["crm", "billing"] },
    { id: "invoice_to_payment", label: "Facture → encaissement (délai médian)", entity: "invoices", groupBy: "recon", measure: "count", unit: "count", view: "bloc", forecastType: "invoice_to_payment", tileOnly: true },
    // ── Échéances fiscales (config dans Paramètres → Organisation) ──
    { id: "fiscal_echeances", label: "Échéances fiscales (TVA · IS · URSSAF)", entity: "fiscal", groupBy: "echeance", measure: "sum", field: "montant", unit: "currency", view: "table" },
    // ── Abonnements / MRR ──
    { id: "mrr_status", label: "MRR par statut d'abonnement", entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" },
    { id: "subs_started_month", label: "Évolution des abonnements démarrés", entity: "subscriptions", groupBy: "month_started", measure: "count", unit: "count", view: "line" },
    { id: "mrr_canceled_month", label: "Évolution du MRR annulé", entity: "subscriptions", groupBy: "month_canceled", measure: "sum", field: "mrr", unit: "currency", view: "line" },
  ],
  // Rapprochement données (agent qualité des données) : câblage et provenance
  // multi-outils — quels documents viennent de quel outil, volumes synchronisés
  // dans le temps, complétude des champs qui servent au rapprochement.
  audit_donnees: [
    { id: "invoices_source", label: "Provenance des factures (rapprochement multi-outils)", entity: "invoices", groupBy: "source", measure: "count", unit: "count", view: "donut" },
    { id: "subs_source", label: "Provenance des abonnements (rapprochement multi-outils)", entity: "subscriptions", groupBy: "source", measure: "count", unit: "count", view: "donut" },
    { id: "tx_source", label: "Provenance des transactions bancaires (rapprochement multi-outils)", entity: "transactions", groupBy: "source", measure: "count", unit: "count", view: "donut" },
    { id: "invoices_synced_month", label: "Volume de factures synchronisées dans le temps", entity: "invoices", groupBy: "month_issued", measure: "count", unit: "count", view: "line" },
    { id: "tx_synced_month", label: "Volume de transactions synchronisées dans le temps", entity: "transactions", groupBy: "month_transaction", measure: "count", unit: "count", view: "line" },
    { id: "subs_synced_month", label: "Volume d'abonnements synchronisés dans le temps", entity: "subscriptions", groupBy: "month_started", measure: "count", unit: "count", view: "line" },
    { id: "invoices_status", label: "Qualité du champ statut des factures", entity: "invoices", groupBy: "status", measure: "count", unit: "count", view: "bar" },
    { id: "companies_country", label: "Complétude du champ pays des entreprises", entity: "companies", groupBy: "country", measure: "count", unit: "count", view: "bar" },
  ],
};

/** Agent (persona) responsable de la création de KPIs personnalisés, par page. */
export const PAGE_AGENT_KEY: Record<string, string> = {
  perf_ventes: "performance",
  perf_marketing: "performance",
  audit_service_client: "service-client",
  audit_paiement_facturation: "paiement-facturation",
  // L'agent Rapprochement de données a été retiré : ses outils d'audit qualité
  // sont passés à l'agent Performances, qui câble donc aussi cette page.
  audit_donnees: "proprietes",
};

/**
 * Clé racine d'une clé de page pour les presets/équipe/agent : identité si la
 * page est connue, sinon la racine par préfixe — les pages custom
 * (perf_ventes_<slug>) héritent des presets de leur page parente.
 */
export function baseTableKey(pageKey: string): string {
  if (TABLE_PRESETS[pageKey]) return pageKey;
  return Object.keys(TABLE_PRESETS).find((b) => pageKey.startsWith(`${b}_`)) ?? pageKey;
}

export function presetsForPage(pageKey: string): TablePreset[] {
  return TABLE_PRESETS[baseTableKey(pageKey)] ?? [];
}

/** Un outil connecté, tel que renvoyé par /api/integrations/connected. */
export type SourceTool = {
  key: string;
  category: ConnectableTool["category"];
  label: string;
  icon: string;
  /**
   * Connecteurs SUR MESURE (`?coverage=1`) : part des enregistrements
   * rattachés à une entreprise, par entité — le périmètre réel des KPIs croisés.
   */
  coverage?: Array<{ entity: string; label: string; total: number; linked: number }>;
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
    // KPI croisé multi-sources : TOUTES les catégories requises sélectionnées
    // (ex : deal → facture exige un CRM ET un outil de facturation).
    if (p.requiresCategories && !p.requiresCategories.every((c) => selectedCats.has(c))) return false;
    const cat = presetSourceCategory(p);
    if (!cat) return true; // entité sans source connue → toujours proposée
    return selectedCats.has(cat);
  });
}
