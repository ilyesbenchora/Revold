import { getByPath } from "@/lib/integrations/sync/field-mapping";

/**
 * CONNECTEUR SUR MESURE — lecture d'une API REST quelconque (ERP maison,
 * logiciel métier interne) déclarée par le client, sans code spécifique.
 *
 * Revold ne devine jamais les endpoints d'un outil inconnu : l'utilisateur les
 * déclare une fois (URL + auth + chemin), Revold les TESTE en direct, détecte
 * les champs disponibles dans la réponse réelle et propose la correspondance
 * vers son modèle canonique. La jointure avec le CRM se fait sur l'ID DE
 * RAPPROCHEMENT (companies.custom_id).
 */

export type AuthType = "none" | "bearer" | "header" | "query";

export type CustomConnector = {
  id: string;
  organization_id: string;
  key: string;
  label: string;
  base_url: string;
  auth_type: AuthType;
  auth_param: string | null;
  auth_value: string | null;
  is_active: boolean;
};

export type Pagination = {
  type: "none" | "page" | "offset" | "cursor";
  /** Nom du paramètre de page/offset/curseur. */
  param?: string;
  /** Nom du paramètre de taille de page. */
  sizeParam?: string;
  size?: number;
  /** Chemin pointé du curseur suivant dans la réponse (type cursor). */
  cursorPath?: string;
};

export type CustomEndpoint = {
  id: string;
  connector_id: string;
  entity: CustomEntity;
  path: string;
  records_path: string | null;
  pagination: Pagination;
  field_map: Record<string, string>;
  is_active: boolean;
};

export const CUSTOM_ENTITIES = [
  "companies",
  "contacts",
  "deals",
  "invoices",
  "subscriptions",
  "transactions",
  "tickets",
] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

/** Provider technique d'un connecteur sur mesure (namespacé, jamais de collision). */
export const customProvider = (key: string) => `custom_${key}`;

// ── Champs canoniques attendus par entité ──────────────────────────────────
// `custom_id` est LA clé de jointure : elle relie l'enregistrement de l'outil
// à l'entreprise du CRM qui porte le même ID de rapprochement.
export type FieldDef = { id: string; label: string; hint: string; required?: boolean; kind?: "date" | "number" };

export const ENTITY_FIELDS: Record<CustomEntity, { label: string; hint: string; fields: FieldDef[] }> = {
  companies: {
    label: "Clients / entreprises",
    hint: "Les comptes de l'outil, rapprochés des entreprises du CRM.",
    fields: [
      { id: "custom_id", label: "ID de rapprochement", hint: "LE champ essentiel : le code client que tes équipes saisissent À LA FOIS dans cet outil et dans le CRM (ex. CLI-00427). C'est lui qui permet à Revold de savoir que la facture de cet outil concerne bien telle entreprise du CRM.", required: true },
      { id: "name", label: "Nom", hint: "Raison sociale ou nom commercial" },
      { id: "external_id", label: "Identifiant interne", hint: "Le numéro ou code que l'outil attribue lui-même à la fiche (souvent « id »). Revold le mémorise pour reconnaître la même fiche aux prochaines synchronisations, sans créer de doublon." },
      { id: "domain", label: "Domaine web", hint: "acme.fr" },
      { id: "siren", label: "SIREN", hint: "9 chiffres, si l'outil le connaît" },
      { id: "vat_number", label: "N° TVA", hint: "FR + 11 caractères" },
    ],
  },
  contacts: {
    label: "Contacts / personnes",
    hint: "Les personnes de l'outil, rattachées aux entreprises du CRM. L'email est la clé d'identification.",
    fields: [
      { id: "email", label: "Email", hint: "Clé d'identification du contact — sans email, la ligne est ignorée", required: true },
      { id: "external_id", label: "ID du contact", hint: "Identifiant technique côté outil" },
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Rattache le contact à son entreprise" },
      { id: "full_name", label: "Nom complet", hint: "Prénom + nom" },
      { id: "phone", label: "Téléphone", hint: "" },
      { id: "title", label: "Fonction", hint: "Poste occupé" },
    ],
  },
  deals: {
    label: "Opportunités / affaires",
    hint: "Les affaires gérées dans l'outil, croisées avec la facturation (CA signé vs facturé).",
    fields: [
      { id: "external_id", label: "ID de l'affaire", hint: "Identifiant technique côté outil", required: true },
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Relie l'affaire à l'entreprise", required: true },
      { id: "name", label: "Nom de l'affaire", hint: "Intitulé de l'opportunité" },
      { id: "amount", label: "Montant", hint: "Valeur de l'affaire", kind: "number" },
      { id: "status", label: "Statut / étape", hint: "« gagné », « signé », « perdu »… interprété automatiquement" },
      { id: "created_date", label: "Date de création", hint: "", kind: "date" },
      { id: "close_date", label: "Date de closing", hint: "Sert au cycle de vente et au CA signé", kind: "date" },
    ],
  },
  invoices: {
    label: "Factures",
    hint: "Croisées avec le CRM : CA signé vs facturé, impayés, délais.",
    fields: [
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Le code client inscrit sur la facture — le même que dans le CRM. C'est lui qui rattache la facture à la bonne entreprise (et permet de comparer CA signé et CA facturé).", required: true },
      { id: "external_id", label: "ID de la facture", hint: "Identifiant technique côté outil", required: true },
      { id: "number", label: "Numéro de facture", hint: "FA-2026-0142" },
      { id: "amount_total", label: "Montant total", hint: "TTC ou HT selon ton outil", kind: "number" },
      { id: "amount_paid", label: "Montant payé", hint: "0 si non payée", kind: "number" },
      { id: "amount_due", label: "Reste dû", hint: "Sert au calcul des impayés", kind: "number" },
      { id: "status", label: "Statut", hint: "paid / open / void…" },
      { id: "issued_at", label: "Date d'émission", hint: "ISO ou YYYY-MM-DD", kind: "date" },
      { id: "paid_at", label: "Date de paiement", hint: "Sert au délai d'encaissement", kind: "date" },
      { id: "due_at", label: "Échéance", hint: "Sert au retard de paiement", kind: "date" },
    ],
  },
  subscriptions: {
    label: "Abonnements",
    hint: "MRR/ARR réconciliés et MRR à risque.",
    fields: [
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Relie l'abonnement à l'entreprise", required: true },
      { id: "external_id", label: "ID de l'abonnement", hint: "Identifiant technique côté outil", required: true },
      { id: "mrr", label: "MRR", hint: "Revenu mensuel récurrent", kind: "number" },
      { id: "status", label: "Statut", hint: "active / trialing / canceled" },
      { id: "started_at", label: "Date de début", hint: "", kind: "date" },
      { id: "canceled_at", label: "Date d'annulation", hint: "", kind: "date" },
    ],
  },
  transactions: {
    label: "Transactions / paiements",
    hint: "Encaissements et décaissements réels.",
    fields: [
      { id: "external_id", label: "ID de la transaction", hint: "Identifiant technique côté outil", required: true },
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Optionnel — relie la transaction à une entreprise" },
      { id: "label", label: "Libellé", hint: "" },
      { id: "amount", label: "Montant", hint: "Positif = encaissement, négatif = décaissement", kind: "number" },
      { id: "date", label: "Date", hint: "", kind: "date" },
      { id: "category", label: "Catégorie", hint: "" },
    ],
  },
  tickets: {
    label: "Tickets / demandes",
    hint: "Croisés avec le revenu : MRR à risque, comptes en tension.",
    fields: [
      { id: "external_id", label: "ID du ticket", hint: "Identifiant technique côté outil", required: true },
      { id: "custom_id", label: "ID de rapprochement du client", hint: "Relie le ticket à l'entreprise" },
      { id: "subject", label: "Sujet", hint: "" },
      { id: "status", label: "Statut", hint: "open / closed…" },
      { id: "priority", label: "Priorité", hint: "" },
      { id: "opened_at", label: "Date d'ouverture", hint: "", kind: "date" },
      { id: "resolved_at", label: "Date de résolution", hint: "", kind: "date" },
    ],
  },
};

// ── Ce que chaque entité DÉBLOQUE dans la plateforme ───────────────────────
/**
 * Le « data model » d'un outil hors catalogue : quelles pages il peut
 * alimenter, quels agents peuvent l'exploiter et quels KPIs deviennent
 * calculables — déduits des ENTITÉS réellement synchronisées, pas d'une
 * promesse. Sert à (1) montrer la couverture avant même la première sync,
 * (2) proposer automatiquement les rattachements « Outil source par page ».
 */
export type EntityTarget = {
  /** Clés de page (tool_mappings) que l'entité alimente. */
  pages: { key: string; label: string }[];
  /** Clés d'agent (tool_mappings agent_<key>) qui peuvent l'exploiter. */
  agents: { key: string; label: string }[];
  /** Exemples de KPIs rendus calculables — vocabulaire du produit. */
  kpis: string[];
};

export const ENTITY_TARGETS: Record<CustomEntity, EntityTarget> = {
  companies: {
    pages: [{ key: "audit_donnees", label: "Rapprochement données" }],
    agents: [{ key: "agent_performance", label: "Agent Performances" }],
    kpis: ["Taux de rapprochement multi-outils", "Entreprises reliées à ≥ 2 outils", "Doublons détectés"],
  },
  contacts: {
    pages: [
      { key: "audit_perf_marketing", label: "Performances — Marketing" },
      { key: "audit_donnees", label: "Rapprochement données" },
    ],
    agents: [{ key: "agent_performance", label: "Agent Performances" }],
    kpis: ["Contacts par entreprise", "Complétude email / téléphone", "Contacts non rattachés"],
  },
  deals: {
    pages: [
      { key: "audit_perf_ventes", label: "Performances — Ventes" },
      { key: "dashboard", label: "Dashboard" },
    ],
    agents: [{ key: "agent_performance", label: "Agent Performances" }],
    kpis: ["CA signé", "Taux de closing", "Cycle de vente", "Écart CA signé ↔ facturé"],
  },
  invoices: {
    pages: [
      { key: "audit_paiement_facturation", label: "Trésorerie" },
      { key: "audit_paiement_facturation_facturation", label: "Trésorerie — Facturation" },
      { key: "dashboard", label: "Dashboard" },
    ],
    agents: [{ key: "agent_paiement-facturation", label: "Agent Trésorerie" }],
    kpis: ["CA facturé", "Impayés", "Délai de paiement (DSO)", "Deals gagnés non facturés"],
  },
  subscriptions: {
    pages: [
      { key: "audit_paiement_facturation", label: "Trésorerie" },
      { key: "dashboard", label: "Dashboard" },
    ],
    agents: [{ key: "agent_paiement-facturation", label: "Agent Trésorerie" }],
    kpis: ["MRR / ARR réconciliés", "Churn revenue", "MRR à risque"],
  },
  transactions: {
    pages: [
      { key: "audit_paiement_facturation_paiement", label: "Trésorerie — Paiement" },
      { key: "audit_paiement_facturation", label: "Trésorerie" },
    ],
    agents: [{ key: "agent_paiement-facturation", label: "Agent Trésorerie" }],
    kpis: ["Encaissements réels", "Décaissements", "Solde net par mois"],
  },
  tickets: {
    pages: [{ key: "audit_service_client", label: "Service Client" }],
    agents: [{ key: "agent_service-client", label: "Agent Service Client" }],
    kpis: ["Volume de tickets", "Comptes en tension", "MRR à risque (support × revenu)"],
  },
};

/** Pages et agents à rattacher pour un ensemble d'entités (dédupliqués). */
export function targetsForEntities(entities: CustomEntity[]): {
  pages: { key: string; label: string }[];
  agents: { key: string; label: string }[];
  kpis: string[];
} {
  const pages = new Map<string, string>();
  const agents = new Map<string, string>();
  const kpis = new Set<string>();
  for (const e of entities) {
    const t = ENTITY_TARGETS[e];
    if (!t) continue;
    for (const p of t.pages) pages.set(p.key, p.label);
    for (const a of t.agents) agents.set(a.key, a.label);
    for (const k of t.kpis) kpis.add(k);
  }
  return {
    pages: [...pages].map(([key, label]) => ({ key, label })),
    agents: [...agents].map(([key, label]) => ({ key, label })),
    kpis: [...kpis],
  };
}

// ── SENS INVERSE : la PAGE choisie détermine les objets à récupérer ────────
/**
 * C'est l'utilisateur qui sait ce qu'il veut alimenter (« GAIA doit servir ma
 * facturation »), pas Revold qui devine ce que l'outil contient. On part donc
 * des PAGES cochées — le même vocabulaire que « Outil source par page » — et
 * on en déduit les objets à aller chercher : les `required` sans lesquels la
 * page reste vide, les `optional` qui l'enrichissent.
 */
export type PageRequirement = {
  key: string;
  label: string;
  group: string;
  /** Sous-page : clé de la page parente (même hiérarchie que « Outil source par page »). */
  parentKey?: string;
  required: CustomEntity[];
  optional: CustomEntity[];
  agent?: { key: string; label: string };
  kpis: string[];
  /**
   * Limite connue : la page attend un type de donnée qui n'a pas d'objet
   * canonique (dépenses publicitaires, appels). Le rattachement reste utile
   * — l'outil devient une source déclarée — mais on le dit au lieu d'afficher
   * un état « prêt » trompeur.
   */
  caveat?: string;
};

export const PAGE_REQUIREMENTS: PageRequirement[] = [
  // ── Performances ────────────────────────────────────────────────────────
  {
    key: "audit_perf_ventes",
    label: "Ventes",
    group: "Performances",
    required: ["deals"],
    optional: ["companies", "contacts"],
    agent: { key: "agent_performance", label: "Agent Performances" },
    kpis: ["CA signé", "Taux de closing", "Cycle de vente", "Écart CA signé ↔ facturé"],
  },
  {
    key: "audit_perf_marketing",
    label: "Marketing",
    group: "Performances",
    required: ["contacts"],
    optional: ["companies", "deals"],
    agent: { key: "agent_performance", label: "Agent Performances" },
    kpis: ["Volume de contacts", "Conversion contact → affaire", "Complétude des fiches"],
  },
  {
    key: "audit_perf_ads",
    label: "Publicité",
    group: "Performances",
    parentKey: "audit_perf_marketing",
    required: [],
    optional: ["contacts", "deals"],
    agent: { key: "agent_performance", label: "Agent Performances" },
    kpis: ["Contacts et affaires générés par campagne"],
    caveat:
      "Les dépenses publicitaires (CPC, ROAS) n'ont pas d'objet à déclarer : cet outil pourra alimenter le volume de contacts et d'affaires de la page, pas le coût des campagnes.",
  },
  {
    key: "audit_appels",
    label: "Appels",
    group: "Performances",
    required: [],
    optional: ["contacts", "companies", "deals"],
    agent: { key: "agent_performance", label: "Agent Performances" },
    kpis: ["Activité rattachée aux contacts et aux affaires"],
    caveat:
      "Le détail du phoning (durée, taux de décroché) n'a pas d'objet à déclarer : l'outil est rattaché à la page, mais ses KPIs d'appels resteront à construire en KPI sur mesure.",
  },
  // ── Trésorerie ──────────────────────────────────────────────────────────
  {
    key: "audit_paiement_facturation",
    label: "Trésorerie (vue d'ensemble)",
    group: "Trésorerie",
    required: ["invoices"],
    optional: ["subscriptions", "transactions", "companies"],
    agent: { key: "agent_paiement-facturation", label: "Agent Trésorerie" },
    kpis: ["MRR / ARR réconciliés", "CA encaissé", "Churn revenue", "Runway"],
  },
  {
    key: "audit_paiement_facturation_facturation",
    label: "Facturation",
    group: "Trésorerie",
    parentKey: "audit_paiement_facturation",
    required: ["invoices"],
    optional: ["companies", "subscriptions"],
    agent: { key: "agent_paiement-facturation", label: "Agent Trésorerie" },
    kpis: ["CA facturé", "Impayés", "Délai de paiement (DSO)", "Deals gagnés non facturés"],
  },
  {
    key: "audit_paiement_facturation_paiement",
    label: "Paiement",
    group: "Trésorerie",
    parentKey: "audit_paiement_facturation",
    required: ["transactions"],
    optional: ["invoices", "companies"],
    agent: { key: "agent_paiement-facturation", label: "Agent Trésorerie" },
    kpis: ["Encaissements réels", "Décaissements", "Solde net par mois"],
  },
  {
    key: "audit_paiement_facturation_comptabilite",
    label: "Comptabilité",
    group: "Trésorerie",
    parentKey: "audit_paiement_facturation",
    required: ["transactions"],
    optional: ["invoices", "companies"],
    agent: { key: "agent_paiement-facturation", label: "Agent Trésorerie" },
    kpis: ["P&L réel", "Répartition des charges", "Balance par classe"],
  },
  {
    key: "audit_paiement_facturation_previsionnel",
    label: "Prévisionnel",
    group: "Trésorerie",
    parentKey: "audit_paiement_facturation",
    required: ["invoices"],
    optional: ["subscriptions", "deals", "transactions"],
    agent: { key: "agent_paiement-facturation", label: "Agent Trésorerie" },
    kpis: ["Projection de trésorerie", "Runway", "Échéances à venir"],
  },
  // ── Service Client ──────────────────────────────────────────────────────
  {
    key: "audit_service_client",
    label: "Service Client",
    group: "Service Client",
    required: ["tickets"],
    optional: ["companies"],
    agent: { key: "agent_service-client", label: "Agent Service Client" },
    kpis: ["Volume de tickets", "Comptes en tension", "MRR à risque (support × revenu)"],
  },
  // ── Données ─────────────────────────────────────────────────────────────
  {
    key: "audit_donnees",
    label: "Rapprochement données",
    group: "Données",
    required: ["companies"],
    optional: ["contacts"],
    agent: { key: "agent_performance", label: "Agent Performances" },
    kpis: ["Taux de rapprochement multi-outils", "Doublons détectés", "Complétude des identifiants"],
  },
  // ── Pilotage ────────────────────────────────────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard (vue de pilotage)",
    group: "Pilotage",
    required: [],
    optional: ["invoices", "deals", "subscriptions"],
    kpis: ["KPIs cross-outils de la page d'accueil"],
  },
];

/** Objets à récupérer pour un ensemble de pages cochées. */
export function entitiesForPages(pageKeys: string[]): { required: CustomEntity[]; optional: CustomEntity[] } {
  const required = new Set<CustomEntity>();
  const optional = new Set<CustomEntity>();
  for (const key of pageKeys) {
    const p = PAGE_REQUIREMENTS.find((x) => x.key === key);
    if (!p) continue;
    for (const e of p.required) required.add(e);
    for (const e of p.optional) optional.add(e);
  }
  // Un objet requis ne doit jamais apparaître comme simplement optionnel.
  for (const e of required) optional.delete(e);
  return { required: [...required], optional: [...optional] };
}

/** Pages/agents à rattacher pour les pages cochées (sens direct, sans déduction). */
export function targetsForPages(pageKeys: string[]): { pages: { key: string; label: string }[]; agents: { key: string; label: string }[] } {
  const pages: { key: string; label: string }[] = [];
  const agents = new Map<string, string>();
  for (const key of pageKeys) {
    const p = PAGE_REQUIREMENTS.find((x) => x.key === key);
    if (!p) continue;
    pages.push({ key: p.key, label: p.label });
    if (p.agent) agents.set(p.agent.key, p.agent.label);
  }
  return { pages, agents: [...agents].map(([key, label]) => ({ key, label })) };
}

/** Familles d'outil proposées (pilote les rattachements par défaut). */
export const CUSTOM_CATEGORIES: { id: string; label: string }[] = [
  { id: "billing", label: "Facturation / ERP / compta" },
  { id: "crm", label: "CRM / gestion commerciale" },
  { id: "support", label: "Support / service client" },
  { id: "files", label: "Métier / production" },
];

// ── Appel HTTP générique ───────────────────────────────────────────────────

function buildUrl(connector: Pick<CustomConnector, "base_url" | "auth_type" | "auth_param" | "auth_value">, path: string, params: Record<string, string>): string {
  const base = connector.base_url.replace(/\/+$/, "");
  const suffix = path.startsWith("http") ? path : `${base}/${path.replace(/^\/+/, "")}`;
  const url = new URL(suffix);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (connector.auth_type === "query" && connector.auth_param && connector.auth_value) {
    url.searchParams.set(connector.auth_param, connector.auth_value);
  }
  return url.toString();
}

function buildHeaders(connector: Pick<CustomConnector, "auth_type" | "auth_param" | "auth_value">): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (connector.auth_type === "bearer" && connector.auth_value) headers.Authorization = `Bearer ${connector.auth_value}`;
  if (connector.auth_type === "header" && connector.auth_param && connector.auth_value) headers[connector.auth_param] = connector.auth_value;
  return headers;
}

export type FetchOutcome =
  | { ok: true; records: Record<string, unknown>[]; raw: unknown; detectedPath: string | null }
  | { ok: false; error: string; status?: number; raw?: unknown };

/** Premier tableau d'objets trouvé dans la réponse (détection du chemin). */
function detectRecordsPath(payload: unknown, prefix = "", depth = 0): { path: string; rows: Record<string, unknown>[] } | null {
  if (depth > 3 || payload == null) return null;
  if (Array.isArray(payload)) {
    const rows = payload.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
    return rows.length > 0 ? { path: prefix, rows } : null;
  }
  if (typeof payload !== "object") return null;
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    const found = detectRecordsPath(v, prefix ? `${prefix}.${k}` : k, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Un appel : renvoie les enregistrements + le chemin détecté si non fourni. */
export async function fetchPage(
  connector: Pick<CustomConnector, "base_url" | "auth_type" | "auth_param" | "auth_value">,
  path: string,
  recordsPath: string | null,
  params: Record<string, string> = {},
): Promise<FetchOutcome> {
  let res: Response;
  try {
    res = await fetch(buildUrl(connector, path, params), {
      headers: buildHeaders(connector),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Appel impossible : ${e.message}` : "Appel impossible" };
  }
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: "La réponse n'est pas du JSON.", status: res.status, raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    return { ok: false, error: `L'outil a répondu ${res.status}.`, status: res.status, raw: payload };
  }
  if (recordsPath) {
    const node = recordsPath ? getNode(payload, recordsPath) : payload;
    const rows = Array.isArray(node) ? (node.filter((r) => r && typeof r === "object") as Record<string, unknown>[]) : [];
    return { ok: true, records: rows, raw: payload, detectedPath: recordsPath };
  }
  const detected = detectRecordsPath(payload);
  return { ok: true, records: detected?.rows ?? [], raw: payload, detectedPath: detected?.path ?? null };
}

/** Navigation par chemin pointé qui préserve les tableaux (contrairement à getByPath). */
function getNode(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Toutes les pages d'un endpoint (bornées) — pagination page / offset / curseur.
 */
export async function fetchAllRecords(
  connector: Pick<CustomConnector, "base_url" | "auth_type" | "auth_param" | "auth_value">,
  endpoint: Pick<CustomEndpoint, "path" | "records_path" | "pagination">,
  limits: { maxPages?: number; maxRecords?: number } = {},
): Promise<{ records: Record<string, unknown>[]; error: string | null }> {
  const maxPages = limits.maxPages ?? 20;
  const maxRecords = limits.maxRecords ?? 5000;
  const p: Pagination = endpoint.pagination ?? { type: "none" };
  const out: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string> = {};
    if (p.type === "page") {
      params[p.param || "page"] = String(i + 1);
      if (p.sizeParam) params[p.sizeParam] = String(p.size ?? 100);
    } else if (p.type === "offset") {
      params[p.param || "offset"] = String(i * (p.size ?? 100));
      if (p.sizeParam) params[p.sizeParam] = String(p.size ?? 100);
    } else if (p.type === "cursor" && cursor) {
      params[p.param || "cursor"] = cursor;
    }

    const page = await fetchPage(connector, endpoint.path, endpoint.records_path, params);
    if (!page.ok) return { records: out, error: page.error };
    out.push(...page.records);
    if (out.length >= maxRecords) break;
    if (p.type === "none") break;
    if (page.records.length === 0) break;
    if (p.type === "cursor") {
      const next = p.cursorPath ? getByPath(page.raw, p.cursorPath) : null;
      if (!next) break;
      cursor = String(next);
    }
  }
  return { records: out.slice(0, maxRecords), error: null };
}

// ── Détection des champs & suggestions de correspondance ───────────────────

/** Chemins pointés disponibles dans un enregistrement (2 niveaux). */
export function flattenKeys(record: Record<string, unknown>, prefix = "", depth = 0): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(record)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) {
      out.push(...flattenKeys(v as Record<string, unknown>, key, depth + 1));
    } else {
      out.push(key);
    }
  }
  return out;
}

/** Indices de nommage pour pré-remplir la correspondance (l'utilisateur corrige). */
const HINTS: Record<string, RegExp> = {
  custom_id: /(code|ref|reference|numero|num)?_?client|client_?(code|id|ref)|customer_?(code|ref|number)|account_?(code|ref)|code_?client/i,
  external_id: /^(id|uuid|_id|identifiant)$/i,
  name: /(raison_?sociale|nom|name|societe|company|libelle_?client|intitule|titre)/i,
  email: /(e?-?mail|courriel)/i,
  full_name: /(nom_?complet|full_?name|contact_?name|prenom_?nom|display_?name)/i,
  phone: /(tel|phone|mobile|portable)/i,
  title: /(fonction|poste|title|job|role)/i,
  created_date: /(date_?(creation|ouverture)|created_?(at|date))/i,
  close_date: /(date_?(closing|signature|cloture|fin)|close_?date|signed_?at)/i,
  domain: /(domain|site|website|url)/i,
  siren: /siren/i,
  vat_number: /(tva|vat)/i,
  number: /(numero_?facture|invoice_?number|num_?facture|reference_?facture)/i,
  amount_total: /(montant_?(ttc|total)?|total_?amount|amount_?total|prix_?total)/i,
  amount_paid: /(paye|paid|regle|encaisse)/i,
  amount_due: /(reste|due|restant|solde|balance)/i,
  status: /(statut|status|etat|state)/i,
  issued_at: /(date_?(emission|facture)|issued|created_?at|date$)/i,
  paid_at: /(date_?(paiement|reglement)|paid_?at|payment_?date)/i,
  due_at: /(echeance|due_?date|deadline)/i,
  mrr: /(mrr|abonnement_?mensuel|monthly)/i,
  started_at: /(debut|start|souscription)/i,
  canceled_at: /(annul|cancel|resili|churn)/i,
  label: /(libelle|label|description|intitule)/i,
  amount: /(montant|amount|valeur)/i,
  date: /(date|jour)/i,
  category: /(categorie|category|type)/i,
  subject: /(sujet|subject|titre|title)/i,
  priority: /(priorite|priority|urgence)/i,
  opened_at: /(ouvert|opened|created)/i,
  resolved_at: /(resolu|resolved|closed|ferme)/i,
};

/** Pré-remplissage : champ canonique → meilleur chemin source détecté. */
export function suggestFieldMap(entity: CustomEntity, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ENTITY_FIELDS[entity].fields) {
    const re = HINTS[f.id];
    if (!re) continue;
    const match = keys.find((k) => re.test(k.split(".").pop() ?? k)) ?? keys.find((k) => re.test(k));
    if (match) out[f.id] = match;
  }
  return out;
}

/** Extrait un enregistrement source → objet canonique, selon la correspondance. */
export function mapRecord(record: Record<string, unknown>, fieldMap: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [canonical, path] of Object.entries(fieldMap)) {
    if (!path) continue;
    out[canonical] = getByPath(record, path);
  }
  return out;
}
