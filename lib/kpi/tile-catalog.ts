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

// ── KPIs support : performance & vélocité ticketing (agrégats canoniques,
// calculés sur le miroir tickets — délais réels HubSpot, SLA, backlog) ──
const SUPPORT_TILES: TileSuggestion[] = [
  { id: "tickets_total", label: "Tickets (total)", description: "Volume total de tickets synchronisés", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "count" } },
  { id: "tickets_backlog", label: "Backlog ouvert", description: "Tickets ouverts / en cours — charge support actuelle", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "count", target: "open" } },
  { id: "tickets_resolus", label: "Tickets résolus", description: "Tickets fermés — volume traité par l'équipe", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "count", target: "closed" } },
  { id: "taux_resolution_tickets", label: "Taux de résolution", description: "% de tickets fermés sur le volume total", unit: "percent", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "count", target: "closed", percent_of_total: true } },
  { id: "premiere_reponse_moy", label: "1ère réponse moyenne (h)", description: "Délai moyen avant la première réponse d'un agent — vélocité d'accueil", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "replied", measure: "avg", field: "first_response_hours", target: "Répondu" } },
  { id: "resolution_moy", label: "Résolution moyenne (h)", description: "Délai moyen entre ouverture et fermeture d'un ticket — vélocité de traitement", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "status", measure: "avg", field: "resolution_hours", target: "closed" } },
  { id: "sla_premiere_reponse_4h", label: "SLA 1ère réponse < 4 h", description: "% des tickets répondus dont la première réponse est arrivée sous 4 h", unit: "percent", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "replied", measure: "avg", field: "sla_4h_hit", target: "Répondu", multiplier: 100 } },
  { id: "tickets_sans_reponse", label: "Tickets sans réponse agent", description: "Tickets sans aucune réponse d'agent enregistrée — angle mort du support", unit: "count", sourceCategory: "support", aggSpec: { entity: "tickets", groupBy: "replied", measure: "count", target: "Sans réponse" } },
];

// ── KPIs produits des deals (line items HubSpot) — l'analyse produit est
// capitale côté Ventes : équipement, profondeur de panier, cross-sell ──
const PRODUCT_TILES: TileSuggestion[] = [
  { id: "deals_avec_produits", label: "Deals avec produits", description: "Deals avec au moins un produit (line item) associé — couverture produit du CRM", unit: "count", sourceCategory: "crm", aggSpec: { entity: "deals", groupBy: "has_products", measure: "count", target: "Avec produits" } },
  { id: "produits_par_deal", label: "Produits par deal", description: "Nombre moyen de produits associés aux deals équipés — profondeur d'équipement", unit: "count", sourceCategory: "crm", aggSpec: { entity: "deals", groupBy: "has_products", measure: "avg", field: "products", target: "Avec produits" } },
  { id: "deals_multi_produits", label: "Deals multi-produits", description: "% des deals équipés portant ≥ 2 produits — pénétration réelle du cross-sell", unit: "percent", sourceCategory: "crm", aggSpec: { entity: "deals", groupBy: "equipement", measure: "count", target: "Multi-produits (≥ 2)", percent_of_total: true } },
  { id: "deals_sans_produit", label: "Deals sans produit", description: "Deals sans aucun line item associé — panier non détaillé, analyse produit aveugle", unit: "count", sourceCategory: "crm", aggSpec: { entity: "deals", groupBy: "has_products", measure: "count", target: "Sans produit" } },
];

// ── KPIs d'enrichissement (état de la donnée officielle des entreprises) —
// suggestions de la page Enrichissement : ce que le moteur produit et que les
// tuiles par défaut ne montrent pas (doublons, vérifications, LinkedIn…) ──
const ENRICHMENT_TILES: TileSuggestion[] = [
  { id: "fiches_enrichies", label: "Fiches enrichies", description: "Entreprises passées par le moteur d'enrichissement (identité officielle posée)", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "enrichie", measure: "count", target: "Enrichies" } },
  { id: "taux_enrichissement", label: "Taux d'enrichissement", description: "% de la base passée par le moteur — couverture globale", unit: "percent", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "enrichie", measure: "count", target: "Enrichies", percent_of_total: true } },
  { id: "sans_siren", label: "Sans SIREN", description: "Entreprises encore sans identifiant officiel — reste à identifier au registre", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "siren_connu", measure: "count", target: "Sans SIREN" } },
  { id: "doublons_siren", label: "Doublons même SIREN", description: "Fiches désignant la même société au registre (SIREN identique) — à fusionner ou relier en établissements", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "doublon_siren", measure: "count", target: "Doublons même SIREN" } },
  { id: "verifiees_registre", label: "Vérifiées au registre", description: "Fiches confrontées au registre officiel (Sirene), avec ou sans correspondance", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "verif_registre", measure: "count", target: "Vérifiées au registre" } },
  { id: "identites_a_valider", label: "Identités à valider", description: "Correspondances plausibles en attente de ta validation (bloc « Identités à valider »)", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "identite_a_valider", measure: "count", target: "À valider" } },
  { id: "effectif_linkedin", label: "Effectifs via LinkedIn", description: "Entreprises dont l'effectif vient de la source LinkedIn (bêta) — complément du registre", unit: "count", sourceCategory: "crm", aggSpec: { entity: "companies", groupBy: "effectif_linkedin", measure: "count", target: "Effectif LinkedIn connu" } },
];

// ── KPIs de phoning (activités « call » du miroir canonique — Aircall & co) :
// suggestions de la page Appels, tous recalculables par période/cohorte ──
const CALL_TILES: TileSuggestion[] = [
  { id: "appels_total", label: "Appels (total)", description: "Volume total d'appels synchronisés depuis l'outil de phoning", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "count" } },
  { id: "appels_sortants", label: "Appels sortants", description: "Volume d'appels émis par l'équipe — l'effort de prospection", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "direction", measure: "count", target: "Sortants" } },
  { id: "appels_entrants", label: "Appels entrants", description: "Volume d'appels reçus — la demande entrante", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "direction", measure: "count", target: "Entrants" } },
  { id: "appels_aboutis", label: "Appels aboutis", description: "Appels décrochés/terminés (non manqués)", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "count", target: "Aboutis" } },
  { id: "appels_manques", label: "Appels manqués", description: "Appels non décrochés — opportunités de rappel", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "count", target: "Manqués" } },
  { id: "taux_decroche", label: "Taux de décroché", description: "% d'appels aboutis sur le volume total", unit: "percent", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "count", target: "Aboutis", percent_of_total: true } },
  { id: "duree_totale_appels", label: "Temps en ligne (min)", description: "Durée cumulée des appels, en minutes", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "sum", field: "duration_minutes" } },
  { id: "duree_moyenne_appel", label: "Durée moyenne (min)", description: "Durée moyenne d'un appel abouti, en minutes", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "statut", measure: "avg", field: "duration_minutes", target: "Aboutis" } },
  { id: "appels_relies_crm", label: "Appels reliés au CRM", description: "Appels rattachés à un contact connu — qualité du rapprochement téléphonie ↔ CRM", unit: "count", sourceCategory: "phone", aggSpec: { entity: "calls", groupBy: "rattachement", measure: "count", target: "Reliés à un contact" } },
];

/** Équipe d'alerte associée aux tuiles de chaque page (KPI personnalisé + création d'alerte). */
export const PAGE_TILE_TEAM: Record<string, string> = {
  perf_ventes: "sales",
  perf_marketing: "marketing",
  audit_paiement_facturation: "revops",
  audit_service_client: "cs",
  audit_donnees: "ops",
  enrichissement: "ops",
  perf_appels: "sales",
};

// Pages « racines » du système de tuiles. Les sous-pages (Trésorerie → Paiement,
// Facturation… ; Rapprochement données → outils) gardent leur propre clé de
// personnalisation mais partagent le catalogue, l'équipe et le filtre d'outils
// de leur page parente.
const TILE_BASE_KEYS = [
  "audit_paiement_facturation",
  "audit_service_client",
  "audit_donnees",
  "perf_ventes",
  "perf_marketing",
];

/** Clé parente d'une clé de page (identité si la page est déjà une racine). */
export function basePageKey(pageKey: string): string {
  return TILE_BASE_KEYS.find((b) => pageKey === b || pageKey.startsWith(`${b}_`)) ?? pageKey;
}

const PAGE_TILE_SUGGESTIONS: Record<string, TileSuggestion[]> = {
  // Analyse générale des deals en tête (closing, CA, panier), pipeline ensuite
  // (valeur, pondéré, couverture), puis l'axe PRODUITS (line items des deals).
  perf_ventes: [
    ...fromKpiDefs(kpisByTeam.sales),
    ...PRODUCT_TILES,
  ],
  perf_marketing: fromKpiDefs(kpisByTeam.marketing),
  audit_paiement_facturation: [
    ...BILLING_TILES,
    ...fromKpiDefs(kpisByTeam.revops.filter((k) => ["revenue_won", "weighted_pipeline", "pipeline_value", "closing_rate"].includes(k.id))),
  ],
  // Ticketing d'abord (performance & vélocité support — cœur de la page),
  // puis les KPIs comptes/rétention CRM du pôle CS.
  audit_service_client: [
    ...SUPPORT_TILES,
    ...fromKpiDefs(kpisByTeam.cs),
  ],
  audit_donnees: fromKpiDefs(kpisByTeam.ops),
  enrichissement: ENRICHMENT_TILES,
  perf_appels: CALL_TILES,
};

/**
 * Catalogue COMPLET des suggestions de KPI, toutes équipes confondues —
 * alimente la liste exhaustive du bloc héro de la home (« ＋ Plus de KPIs »).
 * Dédupliqué par id, chaque entrée porte son équipe d'origine.
 */
export function allTileSuggestions(): (TileSuggestion & { team: string })[] {
  const groups: [string, TileSuggestion[]][] = [
    ["sales", [...fromKpiDefs(kpisByTeam.sales), ...PRODUCT_TILES]],
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
  return (PAGE_TILE_SUGGESTIONS[basePageKey(pageKey)] ?? []).filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}
