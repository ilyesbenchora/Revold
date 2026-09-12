/**
 * Templates de tableaux de bord — 2a du plan « tableaux personnalisables ».
 *
 * Un template = une composition de départ (tuiles KPI + tables de données)
 * seedée sous la clé board_<id> à la création du tableau, via l'infra
 * existante : page_tiles (kind 'kpi', agg_spec résolu par valueFromAggSpec)
 * et page_data_tables. AUCUN nouveau moteur : tout reste modifiable ensuite
 * comme n'importe quelle personnalisation (✎, masquage, drag & drop…).
 *
 * Un template n'est PROPOSÉ que si ses entités ont au moins un enregistrement
 * réellement synchronisé — on ne suggère jamais une page qui afficherait des
 * zéros (même philosophie que ENTITY_TARGETS du connecteur sur mesure).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listConnectedTools } from "@/lib/integrations/tool-mappings";
import { ENTITY_SOURCE_CATEGORY } from "@/lib/reports/data-table-presets";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty } from "@/lib/integrations/hubspot-properties";

export type TemplateTile = {
  title: string;
  unit: "currency" | "count" | "percent";
  /** Spec d'agrégat — même contrat que le cron d'alertes (valueFromAggSpec). */
  agg: {
    entity: string;
    groupBy: string;
    measure: string;
    field?: string;
    target?: string;
    percent_of_total?: boolean;
    multiplier?: number;
  };
};

export type TemplateTable = {
  title: string;
  entity: string;
  group_by: string;
  measure: string;
  field?: string | null;
  unit_mode?: "currency" | "count" | "percent" | null;
  view: "table" | "bar" | "line" | "donut";
  description?: string;
};

export type BoardTemplate = {
  id: string;
  label: string;
  description: string;
  /** Équipe à qui le template s'adresse (regroupement de la galerie). */
  team: "Ventes" | "Marketing" | "Trésorerie" | "Service client" | "Qualité de données";
  /** Croisement multi-outils (proposé en tête de galerie). */
  cross?: boolean;
  /** Entités agrégeables requises (≥ 1 enregistrement synchronisé). */
  entities: string[];
  /**
   * Cohortes (Paramètres → Cohortes) dont dépendent les dimensions du template
   * (segment / industry des entreprises = propriété CRM mappée). Le template
   * n'est proposé que si CHACUNE est mappée ET vérifiée dans le CRM : sinon
   * ses tables afficheraient « inconnu » sur toute la ligne.
   */
  cohorts?: string[];
  tiles: TemplateTile[];
  tables: TemplateTable[];
  /**
   * Compléments CONDITIONNELS : ajoutés à la composition seulement si l'org a
   * des données pour l'entité `when` (ex. factures fournisseurs Pennylane →
   * tuiles/tables fournisseurs + vue combinée). Sinon le template reste tel quel.
   */
  extras?: { when: string; tiles: TemplateTile[]; tables: TemplateTable[] }[];
};

// Complément « factures fournisseurs » partagé par les templates facturation :
// séparation stricte clients / fournisseurs, puis le solde qui combine les deux.
const SUPPLIER_EXTRAS: NonNullable<BoardTemplate["extras"]>[number] = {
  when: "supplier_invoices",
  tiles: [
    { title: "Factures fournisseurs", unit: "currency", agg: { entity: "supplier_invoices", groupBy: "status", measure: "sum", field: "amount_total" } },
    { title: "Reste à payer fournisseurs", unit: "currency", agg: { entity: "supplier_invoices", groupBy: "status", measure: "sum", field: "amount_due" } },
    { title: "Solde facturé (clients − fournisseurs)", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "net_total" } },
  ],
  tables: [
    { title: "Facturé clients vs fournisseurs", entity: "invoices", group_by: "direction", measure: "sum", field: "amount_total", unit_mode: "currency", view: "bar", description: "Les deux sens côte à côte : émis aux clients, reçu des fournisseurs." },
    { title: "Factures fournisseurs reçues par mois", entity: "supplier_invoices", group_by: "month_issued", measure: "sum", field: "amount_total", unit_mode: "currency", view: "line", description: "Charges facturées par les fournisseurs, mois par mois." },
    { title: "Solde facturé par mois (clients − fournisseurs)", entity: "invoices", group_by: "month_issued", measure: "sum", field: "net_total", unit_mode: "currency", view: "line", description: "Ce qui reste une fois les factures fournisseurs déduites du facturé clients." },
  ],
};

/** Libellés des cohortes standard requises par des templates (miroir de STANDARD_COHORTS). */
const COHORT_LABELS: Record<string, string> = { segment: "Segment", industry: "Secteur d'activité", source: "Sources" };

// Factures : la dimension « direction » isole les factures CLIENTS (émises) des
// factures FOURNISSEURS (reçues, ex. Pennylane) — un CA facturé / encaissé qui
// additionnerait les deux serait faux. Les tuiles ciblent la ligne « Clients ».
const CLIENTS = "Clients";

/** Table physique de chaque entité agrégeable (miroir de AGG_ENTITY_TABLES). */
const ENTITY_TABLE: Record<string, string> = {
  deals: "deals",
  invoices: "invoices",
  subscriptions: "subscriptions",
  transactions: "bank_transactions",
  tickets: "tickets",
  contacts: "contacts",
  companies: "companies",
};

// Libellés de statut des deals — mêmes valeurs que DEAL_STATUS_LABELS
// (tool-library) : les agg_spec ciblent ces lignes, ne pas les modifier seuls.
const WON = "Gagnés";
const LOST = "Perdus";
const OPEN = "En cours";

export const BOARD_TEMPLATES: BoardTemplate[] = [
  // ── Propositions par OUTILS CROISÉS (multi-entités, donc multi-outils) :
  // proposées en tête de galerie, par équipe — elles n'apparaissent
  // disponibles que si CHAQUE entité a des données synchronisées, c'est-à-dire
  // quand les outils concernés (CRM + facturation…) sont réellement connectés. ──
  {
    id: "ventes_croisees",
    label: "Ventes — signé → facturé → encaissé",
    description: "Le cycle complet croisé entre ton CRM et ta facturation : ce qui est signé, facturé, encaissé — et l'écart.",
    team: "Ventes",
    cross: true,
    entities: ["deals", "invoices"],
    tiles: [
      { title: "CA signé", unit: "currency", agg: { entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", target: WON } },
      { title: "CA facturé", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_total", target: CLIENTS } },
      { title: "CA encaissé", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_paid", target: CLIENTS } },
      { title: "Pipeline en cours", unit: "currency", agg: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: OPEN } },
    ],
    tables: [
      { title: "CA signé par mois", entity: "deals", group_by: "month_closed", measure: "sum", field: "amount", unit_mode: "currency", view: "line", description: "Montant des deals gagnés, mois par mois (CRM)." },
      { title: "Montant facturé par mois", entity: "invoices", group_by: "month_issued", measure: "sum", field: "amount_total", unit_mode: "currency", view: "line", description: "Montant émis par mois (facturation) — à comparer au signé." },
      { title: "Créances par statut", entity: "invoices", group_by: "status", measure: "sum", field: "amount_due", unit_mode: "currency", view: "bar", description: "Le reste dû : où le cash bloque." },
    ],
    extras: [SUPPLIER_EXTRAS],
  },
  {
    id: "marketing_croise",
    label: "Marketing — du contact au cash",
    description: "La preuve de l'impact marketing au-delà du MQL : qualification croisée avec les deals créés et le facturé.",
    team: "Marketing",
    cross: true,
    entities: ["contacts", "deals", "invoices"],
    tiles: [
      { title: "Contacts MQL", unit: "count", agg: { entity: "contacts", groupBy: "mql", measure: "count", target: "MQL" } },
      { title: "Contacts SQL", unit: "count", agg: { entity: "contacts", groupBy: "sql", measure: "count", target: "SQL" } },
      { title: "CA signé", unit: "currency", agg: { entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", target: WON } },
      { title: "CA encaissé", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_paid", target: CLIENTS } },
    ],
    tables: [
      { title: "Répartition MQL / non-MQL", entity: "contacts", group_by: "mql", measure: "count", unit_mode: "count", view: "donut", description: "Part des contacts qualifiés marketing." },
      { title: "Deals créés par mois", entity: "deals", group_by: "month_created", measure: "count", unit_mode: "count", view: "line", description: "Le pipeline généré en aval du funnel." },
      { title: "Montant facturé par mois", entity: "invoices", group_by: "month_issued", measure: "sum", field: "amount_total", unit_mode: "currency", view: "line", description: "Ce que la chaîne rapporte, en euros facturés." },
    ],
  },
  {
    id: "qualite_donnees",
    label: "Qualité de données",
    description: "La couverture réelle de ta base : les lignes « (vide) » de chaque répartition révèlent les trous à combler.",
    team: "Qualité de données",
    cross: true,
    entities: ["companies", "contacts"],
    cohorts: ["segment", "industry"],
    tiles: [
      // Total (sans cible) sur une dimension toujours résolue — indépendant des cohortes.
      { title: "Entreprises", unit: "count", agg: { entity: "companies", groupBy: "siren_connu", measure: "count" } },
      { title: "Taux de MQL", unit: "percent", agg: { entity: "contacts", groupBy: "mql", measure: "count", target: "MQL", percent_of_total: true } },
    ],
    tables: [
      { title: "Entreprises par segment", entity: "companies", group_by: "segment", measure: "count", unit_mode: "count", view: "bar", description: "Un « (vide) » massif = segmentation à compléter." },
      { title: "Entreprises par industrie", entity: "companies", group_by: "industry", measure: "count", unit_mode: "count", view: "bar", description: "La couverture du champ industrie de ton CRM." },
      { title: "Entreprises par pays", entity: "companies", group_by: "country", measure: "count", unit_mode: "count", view: "bar", description: "La couverture géographique de la base." },
      { title: "Répartition MQL / non-MQL", entity: "contacts", group_by: "mql", measure: "count", unit_mode: "count", view: "donut", description: "La part de contacts réellement qualifiés." },
    ],
  },

  {
    id: "pipeline_commercial",
    label: "Pipeline commercial",
    description: "CA signé, pipeline en cours, taux de perte — et la répartition par étape.",
    team: "Ventes",
    entities: ["deals"],
    tiles: [
      { title: "CA signé", unit: "currency", agg: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: WON } },
      { title: "Pipeline en cours", unit: "currency", agg: { entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: OPEN } },
      { title: "Deals gagnés", unit: "count", agg: { entity: "deals", groupBy: "status", measure: "count", target: WON } },
      { title: "Taux de perte", unit: "percent", agg: { entity: "deals", groupBy: "outcome", measure: "count", target: LOST, percent_of_total: true } },
    ],
    tables: [
      { title: "Deals par étape", entity: "deals", group_by: "stage", measure: "count", unit_mode: "count", view: "bar", description: "Volume de deals à chaque étape du pipeline." },
      { title: "CA signé par mois", entity: "deals", group_by: "month_closed", measure: "sum", field: "amount", unit_mode: "currency", view: "line", description: "Montant des deals clôturés, mois par mois." },
    ],
  },
  {
    id: "cockpit_facturation",
    label: "Cockpit facturation",
    description: "CA facturé, encaissé, impayés — et la dynamique d'émission mensuelle.",
    team: "Trésorerie",
    entities: ["invoices"],
    tiles: [
      { title: "CA facturé", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_total", target: CLIENTS } },
      { title: "CA encaissé", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_paid", target: CLIENTS } },
      { title: "Impayés (reste dû)", unit: "currency", agg: { entity: "invoices", groupBy: "direction", measure: "sum", field: "amount_due", target: CLIENTS } },
      { title: "Factures clients", unit: "count", agg: { entity: "invoices", groupBy: "direction", measure: "count", target: CLIENTS } },
    ],
    tables: [
      { title: "Facturation par mois", entity: "invoices", group_by: "month_issued", measure: "sum", field: "amount_total", unit_mode: "currency", view: "line", description: "Montant facturé par mois d'émission." },
      { title: "Factures par statut", entity: "invoices", group_by: "status", measure: "count", unit_mode: "count", view: "donut", description: "Répartition payées / ouvertes / en retard." },
    ],
    extras: [SUPPLIER_EXTRAS],
  },
  {
    id: "revenu_recurrent",
    label: "Revenu récurrent",
    description: "MRR, ARR, abonnements actifs et churn — la santé du récurrent.",
    team: "Trésorerie",
    entities: ["subscriptions"],
    tiles: [
      { title: "MRR actif", unit: "currency", agg: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active" } },
      { title: "ARR", unit: "currency", agg: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", target: "active", multiplier: 12 } },
      { title: "Abonnements actifs", unit: "count", agg: { entity: "subscriptions", groupBy: "status", measure: "count", target: "active" } },
      { title: "Taux d'annulation", unit: "percent", agg: { entity: "subscriptions", groupBy: "status", measure: "count", target: "canceled", percent_of_total: true } },
    ],
    tables: [
      { title: "Abonnements par statut", entity: "subscriptions", group_by: "status", measure: "count", unit_mode: "count", view: "donut", description: "Actifs, en essai, annulés…" },
      { title: "MRR par mois de démarrage", entity: "subscriptions", group_by: "month_started", measure: "sum", field: "mrr", unit_mode: "currency", view: "line", description: "MRR gagné par cohorte de démarrage." },
    ],
  },
  {
    id: "tresorerie_flux",
    label: "Flux de trésorerie",
    description: "Encaissements, décaissements, flux net — sur les transactions réelles.",
    team: "Trésorerie",
    entities: ["transactions"],
    tiles: [
      { title: "Encaissements", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_in" } },
      { title: "Décaissements", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount_out" } },
      { title: "Flux net", unit: "currency", agg: { entity: "transactions", groupBy: "direction", measure: "sum", field: "amount" } },
      { title: "Transactions", unit: "count", agg: { entity: "transactions", groupBy: "direction", measure: "count" } },
    ],
    tables: [
      { title: "Flux net par mois", entity: "transactions", group_by: "month_transaction", measure: "sum", field: "amount", unit_mode: "currency", view: "line", description: "Encaissements − décaissements, mois par mois." },
      { title: "Dépenses par catégorie", entity: "transactions", group_by: "category", measure: "sum", field: "amount_out", unit_mode: "currency", view: "bar", description: "Où part l'argent, par catégorie de transaction." },
    ],
  },
  {
    id: "suivi_support",
    label: "Suivi support",
    description: "Volume et répartition des tickets — la charge du service client.",
    team: "Service client",
    entities: ["tickets"],
    tiles: [
      { title: "Tickets", unit: "count", agg: { entity: "tickets", groupBy: "status", measure: "count" } },
    ],
    tables: [
      { title: "Tickets par statut", entity: "tickets", group_by: "status", measure: "count", unit_mode: "count", view: "bar", description: "Ouverts, en cours, résolus…" },
    ],
  },
  {
    id: "funnel_marketing",
    label: "Funnel marketing",
    description: "Contacts, MQL, SQL — la qualification de ta base.",
    team: "Marketing",
    entities: ["contacts"],
    tiles: [
      { title: "Contacts MQL", unit: "count", agg: { entity: "contacts", groupBy: "mql", measure: "count", target: "MQL" } },
      { title: "Contacts SQL", unit: "count", agg: { entity: "contacts", groupBy: "sql", measure: "count", target: "SQL" } },
      { title: "Taux de MQL", unit: "percent", agg: { entity: "contacts", groupBy: "mql", measure: "count", target: "MQL", percent_of_total: true } },
    ],
    tables: [
      { title: "Répartition MQL / non-MQL", entity: "contacts", group_by: "mql", measure: "count", unit_mode: "count", view: "donut", description: "Part des contacts qualifiés marketing." },
      { title: "Répartition SQL / non-SQL", entity: "contacts", group_by: "sql", measure: "count", unit_mode: "count", view: "donut", description: "Part des contacts qualifiés sales." },
    ],
  },
  {
    id: "portefeuille_clients",
    label: "Portefeuille clients",
    description: "Tes entreprises par segment et par secteur — les cohortes mappées dans Paramètres → Cohortes.",
    team: "Qualité de données",
    entities: ["companies"],
    cohorts: ["segment", "industry"],
    tiles: [
      // Total (sans cible) sur une dimension toujours résolue — indépendant des cohortes.
      { title: "Entreprises", unit: "count", agg: { entity: "companies", groupBy: "siren_connu", measure: "count" } },
    ],
    tables: [
      { title: "Entreprises par segment", entity: "companies", group_by: "segment", measure: "count", unit_mode: "count", view: "bar", description: "PME / ETI / Enterprise…" },
      { title: "Entreprises par industrie", entity: "companies", group_by: "industry", measure: "count", unit_mode: "count", view: "bar", description: "Les secteurs de ton portefeuille." },
    ],
  },
];

/** Version sérialisable pour le client (modal de création). */
export type BoardTemplateOption = { id: string; label: string; description: string };

/** Outil connecté qui alimente un template (logo affiché sur la carte). */
export type TemplateTool = { key: string; label: string; domain: string; icon: string };

/**
 * État d'une cohorte requise par un template : `ok` = mappée sur une propriété
 * Entreprise ET vérifiée dans le CRM ; `unmapped` = aucune propriété saisie ;
 * `wrong_object` = mappée sur un autre objet (contact / deal) ; `missing` =
 * propriété introuvable dans le CRM ; `unverifiable` = CRM non connecté.
 */
export type TemplateCohortStatus = {
  key: string;
  label: string;
  state: "ok" | "unmapped" | "wrong_object" | "missing" | "unverifiable";
};

/**
 * Vérifie les cohortes requises par les templates — MÊME contrôle que
 * Paramètres → Cohortes (propriété mappée + existence vérifiée dans HubSpot).
 * Une seule lecture du mapping et une vérification par cohorte.
 */
export async function templateCohortStatuses(
  supabase: SupabaseClient,
  orgId: string,
  keys: string[] = [...new Set(BOARD_TEMPLATES.flatMap((t) => t.cohorts ?? []))],
): Promise<Map<string, TemplateCohortStatus>> {
  const out = new Map<string, TemplateCohortStatus>();
  if (keys.length === 0) return out;
  type Mapping = { key?: string; label?: string; internal_name?: string; api_name?: string; object?: string };
  let mappings: Mapping[] = [];
  try {
    const { data } = await supabase.from("cohort_mappings").select("mappings").eq("organization_id", orgId).maybeSingle();
    if (Array.isArray(data?.mappings)) mappings = data.mappings as Mapping[];
  } catch {
    /* table absente → aucune cohorte mappée */
  }
  const token = await getHubSpotToken(supabase, orgId).catch(() => null);
  await Promise.all(
    keys.map(async (key) => {
      const m = mappings.find((x) => x.key === key);
      const label = (m?.internal_name ?? "").trim() || COHORT_LABELS[key] || key;
      const apiName = (m?.api_name ?? "").trim();
      if (!apiName) return out.set(key, { key, label, state: "unmapped" });
      // Objet vide = détection legacy (Entreprise) ; un autre objet ne peut pas
      // regrouper les entreprises.
      if (m?.object && m.object !== "companies") return out.set(key, { key, label, state: "wrong_object" });
      if (!token) return out.set(key, { key, label, state: "unverifiable" });
      const check = await checkHubSpotProperty(token, "companies", apiName, m?.internal_name).catch(() => null);
      out.set(key, { key, label, state: check?.exists === true ? "ok" : check?.exists === false ? "missing" : "unverifiable" });
    }),
  );
  return out;
}

/** Cohortes NON validées d'un template (vide = template câblable). */
export function blockingCohorts(tpl: BoardTemplate, statuses: Map<string, TemplateCohortStatus>): TemplateCohortStatus[] {
  return (tpl.cohorts ?? [])
    .map((k) => statuses.get(k) ?? { key: k, label: COHORT_LABELS[k] ?? k, state: "unmapped" as const })
    .filter((s) => s.state !== "ok");
}

/** Carte de la galerie Templates : composition détaillée + disponibilité. */
export type BoardTemplateGalleryItem = BoardTemplateOption & {
  available: boolean;
  /** Entités requises sans aucune donnée synchronisée (raison d'indisponibilité). */
  missingEntities: string[];
  /** Cohortes requises par le template, avec leur état de validation. */
  cohorts: TemplateCohortStatus[];
  /** Équipe (regroupement de la galerie) + proposition croisée multi-outils. */
  team: BoardTemplate["team"];
  cross: boolean;
  /** Outils CONNECTÉS de l'org qui portent les données de ce template. */
  tools: TemplateTool[];
  /** Entités requises (libellés d'affichage gérés côté page). */
  entities: string[];
  tileTitles: string[];
  tableTitles: string[];
  /** Composition détaillée pour l'APERÇU visuel de la carte (mini-dashboard). */
  previewTiles: { title: string; unit: "currency" | "count" | "percent" }[];
  previewTables: { title: string; view: "table" | "bar" | "line" | "donut" }[];
};

/** Volumes synchronisés par entité agrégeable (comptages head, coût borné). */
async function entityCounts(supabase: SupabaseClient, orgId: string): Promise<Map<string, number>> {
  const entities = [
    ...new Set(BOARD_TEMPLATES.flatMap((t) => [...t.entities, ...(t.extras ?? []).map((x) => x.when)])),
  ];
  const counts = new Map<string, number>();
  await Promise.all(
    entities.map(async (e) => {
      // Pseudo-entité factures fournisseurs : même table, direction 'out'.
      const table = e === "supplier_invoices" ? "invoices" : ENTITY_TABLE[e];
      if (!table) return counts.set(e, 0);
      try {
        let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
        if (e === "supplier_invoices") q = q.eq("direction", "out");
        const { count, error } = await q;
        counts.set(e, error ? 0 : count ?? 0);
      } catch {
        counts.set(e, 0);
      }
    }),
  );
  return counts;
}

/** Composition EFFECTIVE d'un template pour l'org : base + compléments dont l'entité a des données. */
function effectiveComposition(tpl: BoardTemplate, counts: Map<string, number>): BoardComposition {
  const tiles = [...tpl.tiles];
  const tables = [...tpl.tables];
  for (const x of tpl.extras ?? []) {
    if ((counts.get(x.when) ?? 0) > 0) {
      tiles.push(...x.tiles);
      tables.push(...x.tables);
    }
  }
  return { tiles, tables };
}

/**
 * Templates réellement proposables : chaque entité requise a au moins un
 * enregistrement synchronisé ET chaque cohorte requise est mappée + vérifiée.
 */
export async function availableBoardTemplates(
  supabase: SupabaseClient,
  orgId: string,
): Promise<BoardTemplateOption[]> {
  const [counts, cohorts] = await Promise.all([entityCounts(supabase, orgId), templateCohortStatuses(supabase, orgId)]);
  return BOARD_TEMPLATES.filter(
    (t) => t.entities.every((e) => (counts.get(e) ?? 0) > 0) && blockingCohorts(t, cohorts).length === 0,
  ).map((t) => ({ id: t.id, label: t.label, description: t.description }));
}

/**
 * Galerie complète (page Templates) : TOUS les templates avec leur composition
 * et leur disponibilité — les indisponibles restent visibles (ils montrent ce
 * que débloquerait la connexion d'un outil).
 */
export async function boardTemplateGallery(
  supabase: SupabaseClient,
  orgId: string,
): Promise<BoardTemplateGalleryItem[]> {
  const [counts, connected, cohortStatuses] = await Promise.all([
    entityCounts(supabase, orgId),
    listConnectedTools(supabase, orgId).catch(() => []),
    templateCohortStatuses(supabase, orgId),
  ]);
  // Outils connectés qui portent chaque catégorie d'entité (crm/billing/support) :
  // les logos affichés sur la carte = les outils dont les DONNÉES alimentent le template.
  const byCategory = new Map<string, TemplateTool[]>();
  for (const t of connected) {
    if (t.category === "communication") continue;
    const list = byCategory.get(t.category) ?? [];
    list.push({ key: t.key, label: t.label, domain: t.domain, icon: t.icon });
    byCategory.set(t.category, list);
  }
  const toolsFor = (entities: string[]): TemplateTool[] => {
    const cats = [...new Set(entities.map((e) => ENTITY_SOURCE_CATEGORY[e]).filter(Boolean))];
    const seen = new Set<string>();
    const out: TemplateTool[] = [];
    for (const c of cats) {
      for (const tool of byCategory.get(c as string) ?? []) {
        if (seen.has(tool.key)) continue;
        seen.add(tool.key);
        out.push(tool);
      }
    }
    return out;
  };
  return BOARD_TEMPLATES.map((t) => {
    const missingEntities = t.entities.filter((e) => (counts.get(e) ?? 0) === 0);
    const comp = effectiveComposition(t, counts);
    const cohorts = (t.cohorts ?? []).map(
      (k) => cohortStatuses.get(k) ?? { key: k, label: COHORT_LABELS[k] ?? k, state: "unmapped" as const },
    );
    return {
    id: t.id,
    label: t.label,
    description: t.description,
    available: missingEntities.length === 0 && cohorts.every((c) => c.state === "ok"),
    missingEntities,
    cohorts,
    team: t.team,
    cross: t.cross === true,
    tools: toolsFor(t.entities),
    entities: t.entities,
    tileTitles: comp.tiles.map((x) => x.title),
    tableTitles: comp.tables.map((x) => x.title),
    previewTiles: comp.tiles.map((x) => ({ title: x.title, unit: x.unit })),
    previewTables: comp.tables.map((x) => ({ title: x.title, view: x.view })),
    };
  });
}

/** Composition seedable (template statique ou proposition de l'agent). */
export type BoardComposition = { tiles: TemplateTile[]; tables: TemplateTable[] };

/**
 * Seed une composition (tuiles + tables) sous la clé board_<id> — best effort :
 * une insertion qui échoue n'empêche pas la création du tableau (la page
 * reste utilisable vierge).
 */
export async function seedBoardComposition(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  boardId: string,
  tpl: BoardComposition,
): Promise<void> {
  const pageKey = `board_${boardId}`;

  try {
    if (tpl.tiles.length > 0) {
      await supabase.from("page_tiles").insert(
        tpl.tiles.map((t, i) => ({
          organization_id: orgId,
          page_key: pageKey,
          kind: "kpi",
          title: t.title,
          unit_mode: t.unit,
          agg_spec: t.agg,
          position: i,
          created_by: userId,
        })),
      );
    }
  } catch {
    /* best effort — le tableau vierge reste créé */
  }
  try {
    if (tpl.tables.length > 0) {
      await supabase.from("page_data_tables").insert(
        tpl.tables.map((t, i) => ({
          organization_id: orgId,
          page_key: pageKey,
          title: t.title,
          entity: t.entity,
          group_by: t.group_by,
          measure: t.measure,
          field: t.field ?? null,
          unit_mode: t.unit_mode ?? null,
          view: t.view,
          period_preset: "all",
          sources: [],
          description: t.description ?? null,
          position: i,
          created_by: userId,
        })),
      );
    }
  } catch {
    /* idem — les tuiles seedées restent en place */
  }
}

/** Seed la composition d'un template statique (id du catalogue). */
export async function seedBoardFromTemplate(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  boardId: string,
  templateId: string,
): Promise<void> {
  const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  // Compléments conditionnels (ex. factures fournisseurs) : seedés seulement
  // si l'org a réellement ces données — jamais une tuile à zéro par principe.
  const counts = tpl.extras?.length ? await entityCounts(supabase, orgId) : new Map<string, number>();
  await seedBoardComposition(supabase, orgId, userId, boardId, effectiveComposition(tpl, counts));
}
