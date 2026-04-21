/**
 * HubSpot Snapshot — source de vérité unifiée pour TOUTES les pages Revold.
 *
 * Pattern : 1 seul appel `fetchHubSpotSnapshot(token)` retourne en parallèle
 * tous les counts, distributions et stats nécessaires aux pages dashboard.
 * Chaque page consomme la portion qui l'intéresse — fini les Supabase fallbacks
 * qui retournent 0 quand la sync n'a pas tourné.
 */

import {
  fetchHubSpotEcosystemCounts,
  EMPTY_ECOSYSTEM_COUNTS,
  type HubSpotEcosystemCounts,
} from "./hubspot";

const HUBSPOT_API = "https://api.hubapi.com";

// ────────────────────────────────────────────────────────────────────────────
// HELPERS BAS NIVEAU
// ────────────────────────────────────────────────────────────────────────────

/**
 * Diagnostic du statut d'un KPI individuel — permet de différencier
 * "vraiment 0" d'un échec API silencieux (scope manquant, addon HubSpot
 * non activé, propriété inexistante, panne réseau).
 *
 *  - "ok"           : appel HTTP 200, valeur lue normalement (peut être 0)
 *  - "no_scope"     : HTTP 401/403 — scope OAuth manquant
 *  - "addon_missing": HTTP 404 (objet inexistant : Service Hub / Invoicing
 *                     non activé sur ce portail)
 *  - "bad_property" : HTTP 400 (la propriété demandée n'existe pas)
 *  - "endpoint_error": autre HTTP 4xx/5xx
 *  - "network_error": exception réseau / timeout
 */
export type KpiStatus =
  | "ok"
  | "no_scope"
  | "addon_missing"
  | "bad_property"
  | "endpoint_error"
  | "network_error";

export type KpiDiagnosticEntry = { status: KpiStatus; httpCode?: number; detail?: string };

function classifyHttpError(status: number, body: string): KpiStatus {
  if (status === 401 || status === 403) return "no_scope";
  if (status === 404) return "addon_missing";
  if (status === 400) {
    // HubSpot répond 400 si une property dans le filter n'existe pas
    if (/property|does not exist|not a known property/i.test(body)) return "bad_property";
    return "endpoint_error";
  }
  return "endpoint_error";
}

/**
 * Fait un /search?limit=1 et tracke le statut dans `diag` sous la clé `kpiKey`.
 * Retourne UNIQUEMENT la valeur numérique (compat avec le code existant).
 * Le statut est lisible via `diag.get(kpiKey)`.
 */
async function searchTotal(
  token: string,
  objectType: string,
  body?: object,
  diag?: Map<string, KpiDiagnosticEntry>,
  kpiKey?: string,
): Promise<number> {
  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, ...body }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (diag && kpiKey) {
        diag.set(kpiKey, {
          status: classifyHttpError(res.status, errBody),
          httpCode: res.status,
          detail: errBody.slice(0, 160),
        });
      }
      return 0;
    }
    const data = await res.json();
    const total = typeof data.total === "number" ? data.total : 0;
    if (diag && kpiKey) diag.set(kpiKey, { status: "ok", httpCode: 200 });
    return total;
  } catch (err) {
    if (diag && kpiKey) {
      diag.set(kpiKey, {
        status: "network_error",
        detail: err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160),
      });
    }
    return 0;
  }
}

async function searchSum(
  token: string,
  objectType: string,
  property: string,
  body?: object,
  diag?: Map<string, KpiDiagnosticEntry>,
  kpiKey?: string,
): Promise<number> {
  // Aggregate sum sur une propriété — pas d'endpoint dédié dans HubSpot Public,
  // donc on pagine sur 5 pages max et on somme. Cap volontaire pour éviter les
  // requêtes massives sur les très gros comptes.
  let total = 0;
  let after: string | undefined;
  let page = 0;
  let firstError: KpiDiagnosticEntry | null = null;

  do {
    try {
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/${objectType}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 100,
          properties: [property],
          ...(after ? { after } : {}),
          ...body,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        firstError = {
          status: classifyHttpError(res.status, errBody),
          httpCode: res.status,
          detail: errBody.slice(0, 160),
        };
        break;
      }
      const data = await res.json();
      const results = (data.results ?? []) as Array<{ properties?: Record<string, string> }>;
      for (const r of results) {
        const v = parseFloat(r.properties?.[property] ?? "0");
        if (!isNaN(v)) total += v;
      }
      after = data.paging?.next?.after;
      page++;
    } catch (err) {
      firstError = {
        status: "network_error",
        detail: err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160),
      };
      break;
    }
  } while (after && page < 5);

  if (diag && kpiKey) diag.set(kpiKey, firstError ?? { status: "ok", httpCode: 200 });
  return total;
}

// ────────────────────────────────────────────────────────────────────────────
// LIFECYCLE DISTRIBUTION
// ────────────────────────────────────────────────────────────────────────────

export type LifecycleStageInfo = { value: string; label: string; count: number };

export async function fetchLifecycleDistribution(token: string): Promise<{
  byStage: Record<string, LifecycleStageInfo>;
  total: number;
  leadsLikeCount: number;
  oppsLikeCount: number;
  customersCount: number;
}> {
  // 1. Définition de la propriété (inclut les options custom)
  let stages: Array<{ value: string; label: string }> = [];
  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/properties/contacts/lifecyclestage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      stages = ((data.options ?? []) as Array<{ value: string; label: string; hidden?: boolean }>)
        .filter((o) => !o.hidden);
    }
  } catch {}

  if (stages.length === 0) {
    stages = [
      { value: "subscriber", label: "Subscriber" },
      { value: "lead", label: "Lead" },
      { value: "marketingqualifiedlead", label: "Marketing Qualified Lead" },
      { value: "salesqualifiedlead", label: "Sales Qualified Lead" },
      { value: "opportunity", label: "Opportunity" },
      { value: "customer", label: "Customer" },
      { value: "evangelist", label: "Evangelist" },
      { value: "other", label: "Other" },
    ];
  }

  const counts = await Promise.all(
    stages.map(async (s) => {
      const c = await searchTotal(token, "contacts", {
        filterGroups: [{ filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: s.value }] }],
      });
      return { value: s.value, label: s.label, count: c };
    }),
  );

  const byStage: Record<string, LifecycleStageInfo> = {};
  let total = 0;
  for (const c of counts) {
    byStage[c.value] = c;
    total += c.count;
  }

  const matchAny = (stage: string, label: string, needles: string[]): boolean => {
    const s = `${stage} ${label}`.toLowerCase();
    return needles.some((n) => s.includes(n.toLowerCase()));
  };

  let leadsLike = 0;
  let oppsLike = 0;
  let customers = 0;
  for (const c of counts) {
    if (matchAny(c.value, c.label, ["subscriber", "lead", "marketingqualifiedlead", "mql", "marketing qualified"])) {
      leadsLike += c.count;
    }
    if (matchAny(c.value, c.label, ["salesqualifiedlead", "sql", "sales qualified", "opportunity", "opportunit", "customer", "client", "evangelist"])) {
      oppsLike += c.count;
    }
    if (matchAny(c.value, c.label, ["customer", "client"])) {
      customers += c.count;
    }
  }

  return { byStage, total, leadsLikeCount: leadsLike, oppsLikeCount: oppsLike, customersCount: customers };
}

// ────────────────────────────────────────────────────────────────────────────
// PIPELINES (deals)
// ────────────────────────────────────────────────────────────────────────────

export type PipelineStage = {
  id: string;
  label: string;
  displayOrder: number;
  probability: number;
  closedWon: boolean;
  closedLost: boolean;
};

export type PipelineInfo = {
  id: string;
  label: string;
  displayOrder: number;
  archived: boolean;
  stages: PipelineStage[];
};

export async function fetchDealsPipelines(token: string): Promise<PipelineInfo[]> {
  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Array<{
      id: string;
      label: string;
      displayOrder: number;
      archived?: boolean;
      stages?: Array<{
        id: string;
        label: string;
        displayOrder: number;
        metadata?: { probability?: string; isClosed?: string };
      }>;
    }>).map((p) => ({
      id: p.id,
      label: p.label,
      displayOrder: p.displayOrder,
      archived: p.archived === true,
      stages: (p.stages ?? []).map((s) => {
        const probStr = s.metadata?.probability ?? "0";
        const probability = Math.round(parseFloat(probStr) * 100);
        const isClosed = s.metadata?.isClosed === "true";
        return {
          id: s.id,
          label: s.label,
          displayOrder: s.displayOrder,
          probability,
          closedWon: isClosed && probability >= 100,
          closedLost: isClosed && probability < 100,
        };
      }),
    }));
  } catch {
    return [];
  }
}

/** Compte les deals par stage pour un pipeline donné. */
export async function fetchDealsCountByStage(
  token: string,
  pipelineId: string,
): Promise<Record<string, number>> {
  try {
    // Une requête par stage est inefficace si beaucoup. On fait un /search
    // avec aggregations via groupBy n'existe pas — on récupère donc tous
    // les deals du pipeline (paginé) et on groupe en mémoire.
    const counts: Record<string, number> = {};
    let after: string | undefined;
    let page = 0;
    do {
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }] }],
          properties: ["dealstage"],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const results = (data.results ?? []) as Array<{ properties: { dealstage?: string } }>;
      for (const r of results) {
        const stage = r.properties.dealstage ?? "unknown";
        counts[stage] = (counts[stage] ?? 0) + 1;
      }
      after = data.paging?.next?.after;
      page++;
    } while (after && page < 20); // cap 2000 deals par pipeline pour ne pas exploser
    return counts;
  } catch {
    return {};
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SNAPSHOT GLOBAL — source de vérité pour TOUTES les pages
// ────────────────────────────────────────────────────────────────────────────

export type HubSpotSnapshot = {
  // Core counts
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  closingRate: number;
  dealsNoNextActivity: number;
  dealsNoAmount: number;
  dealsNoCloseDate: number;
  stagnantDeals: number;
  dealsAtRisk: number; // open deals avec probability < 30%

  // Pipeline value
  totalPipelineAmount: number; // sum amount des deals open
  wonAmount: number; // sum amount des deals won

  // Contacts
  totalContacts: number;
  leadsCount: number;
  opportunitiesCount: number;
  customersCount: number;
  conversionRate: number;
  orphansCount: number;
  orphanRate: number;
  contactsNoPhone: number;
  contactsNoTitle: number;
  contactsNoEmail: number;

  // Companies
  totalCompanies: number;
  companiesNoIndustry: number;
  companiesNoRevenue: number;
  companiesNoDomain: number;

  // Lifecycle distribution
  lifecycleByStage: Record<string, LifecycleStageInfo>;

  // Pipelines
  pipelines: PipelineInfo[];

  // Owners
  ownersCount: number;

  // Service / Support
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  totalConversations: number;
  feedbackCount: number;

  // Revenue (HubSpot natif)
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalSubscriptions: number;
  activeSubscriptions: number;

  // Sales tools
  totalQuotes: number;
  totalLineItems: number;
  sequencesEnrollments: number;
  forecastsCount: number;
  goalsCount: number;
  leadsObjectCount: number;

  // Marketing
  formsCount: number;
  marketingCampaignsCount: number;
  marketingEventsCount: number;

  // Workspace
  workflowsCount: number;
  workflowsActiveCount: number;
  listsCount: number;
  customObjectsCount: number;
  teamsCount: number;
  appointmentsCount: number;
  listingsCount: number;
  projectsCount: number;
  usersCount: number;

  // Whole ecosystem snapshot
  ecosystem: HubSpotEcosystemCounts;

  /**
   * Diagnostic per-KPI : permet de différencier "vraiment 0" d'un échec
   * silencieux (scope manquant, addon HubSpot non activé, etc.).
   * La clé est le nom du KPI (ex: "totalDeals", "totalTickets",
   * "totalInvoices"). Les UI peuvent afficher "—" + tooltip explicatif
   * au lieu de "0" quand status !== "ok".
   */
  kpiDiagnostics: Record<string, KpiDiagnosticEntry>;
};

export const EMPTY_SNAPSHOT: HubSpotSnapshot = {
  totalDeals: 0,
  wonDeals: 0,
  lostDeals: 0,
  openDeals: 0,
  closingRate: 0,
  dealsNoNextActivity: 0,
  dealsNoAmount: 0,
  dealsNoCloseDate: 0,
  stagnantDeals: 0,
  dealsAtRisk: 0,
  totalPipelineAmount: 0,
  wonAmount: 0,
  totalContacts: 0,
  leadsCount: 0,
  opportunitiesCount: 0,
  customersCount: 0,
  conversionRate: 0,
  orphansCount: 0,
  orphanRate: 0,
  contactsNoPhone: 0,
  contactsNoTitle: 0,
  contactsNoEmail: 0,
  totalCompanies: 0,
  companiesNoIndustry: 0,
  companiesNoRevenue: 0,
  companiesNoDomain: 0,
  lifecycleByStage: {},
  pipelines: [],
  ownersCount: 0,
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  totalConversations: 0,
  feedbackCount: 0,
  totalInvoices: 0,
  paidInvoices: 0,
  unpaidInvoices: 0,
  totalSubscriptions: 0,
  activeSubscriptions: 0,
  totalQuotes: 0,
  totalLineItems: 0,
  sequencesEnrollments: 0,
  forecastsCount: 0,
  goalsCount: 0,
  leadsObjectCount: 0,
  formsCount: 0,
  marketingCampaignsCount: 0,
  marketingEventsCount: 0,
  workflowsCount: 0,
  workflowsActiveCount: 0,
  listsCount: 0,
  customObjectsCount: 0,
  teamsCount: 0,
  appointmentsCount: 0,
  listingsCount: 0,
  projectsCount: 0,
  usersCount: 0,
  ecosystem: EMPTY_ECOSYSTEM_COUNTS,
  kpiDiagnostics: {},
};

/**
 * THE FETCH. Récupère TOUTES les stats HubSpot nécessaires aux pages Revold
 * en parallèle. ~30 requêtes HubSpot toutes /search?limit=1 ou paginées
 * légères. Doit être appelée 1 seule fois par render via le cache helper.
 */
export async function fetchHubSpotSnapshot(token: string): Promise<HubSpotSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime();
  const diag = new Map<string, KpiDiagnosticEntry>();
  let ownersStatus: KpiDiagnosticEntry = { status: "ok" };

  const [
    totalDeals,
    wonDeals,
    lostDeals,
    dealsNoNextActivity,
    dealsNoAmount,
    dealsNoCloseDate,
    dealsStagnant,
    dealsAtRisk,
    totalPipelineAmount,
    wonAmount,
    totalContacts,
    orphansCount,
    contactsNoPhone,
    contactsNoTitle,
    contactsNoEmail,
    totalCompanies,
    companiesNoIndustry,
    companiesNoRevenue,
    companiesNoDomain,
    lifecycle,
    pipelines,
    ownersList,
    openTickets,
    closedTickets,
    paidInvoices,
    unpaidInvoices,
    activeSubscriptions,
    ecosystem,
  ] = await Promise.all([
    // ── Deals ──
    searchTotal(token, "deals", undefined, diag, "totalDeals"),
    searchTotal(token, "deals", { filterGroups: [{ filters: [{ propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }] }] }, diag, "wonDeals"),
    searchTotal(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "EQ", value: "true" },
          { propertyName: "hs_is_closed_won", operator: "NEQ", value: "true" },
        ],
      }],
    }, diag, "lostDeals"),
    searchTotal(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
          { propertyName: "notes_next_activity_date", operator: "NOT_HAS_PROPERTY" },
        ],
      }],
    }, diag, "dealsNoNextActivity"),
    searchTotal(token, "deals", { filterGroups: [{ filters: [{ propertyName: "amount", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "dealsNoAmount"),
    searchTotal(token, "deals", { filterGroups: [{ filters: [{ propertyName: "closedate", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "dealsNoCloseDate"),
    searchTotal(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
          { propertyName: "notes_next_activity_date", operator: "NOT_HAS_PROPERTY" },
          { propertyName: "notes_last_contacted", operator: "LT", value: String(sevenDaysAgo) },
        ],
      }],
    }, diag, "stagnantDeals"),
    searchTotal(token, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
          { propertyName: "hs_deal_stage_probability", operator: "LT", value: "0.30" },
        ],
      }],
    }, diag, "dealsAtRisk"),
    searchSum(token, "deals", "amount", {
      filterGroups: [{ filters: [{ propertyName: "hs_is_closed", operator: "NEQ", value: "true" }] }],
    }, diag, "totalPipelineAmount"),
    searchSum(token, "deals", "amount", {
      filterGroups: [{ filters: [{ propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }] }],
    }, diag, "wonAmount"),
    // ── Contacts ──
    searchTotal(token, "contacts", undefined, diag, "totalContacts"),
    searchTotal(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "associatedcompanyid", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "orphansCount"),
    searchTotal(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "phone", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "contactsNoPhone"),
    searchTotal(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "jobtitle", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "contactsNoTitle"),
    searchTotal(token, "contacts", { filterGroups: [{ filters: [{ propertyName: "email", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "contactsNoEmail"),
    // ── Companies ──
    searchTotal(token, "companies", undefined, diag, "totalCompanies"),
    searchTotal(token, "companies", { filterGroups: [{ filters: [{ propertyName: "industry", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "companiesNoIndustry"),
    searchTotal(token, "companies", { filterGroups: [{ filters: [{ propertyName: "annualrevenue", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "companiesNoRevenue"),
    searchTotal(token, "companies", { filterGroups: [{ filters: [{ propertyName: "domain", operator: "NOT_HAS_PROPERTY" }] }] }, diag, "companiesNoDomain"),
    // ── Lifecycle distribution ──
    fetchLifecycleDistribution(token),
    // ── Pipelines ──
    fetchDealsPipelines(token),
    // ── Owners ──
    fetch(`${HUBSPOT_API}/crm/v3/owners?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const errBody = await r.text().catch(() => "");
          ownersStatus = { status: classifyHttpError(r.status, errBody), httpCode: r.status, detail: errBody.slice(0, 160) };
          return { results: [] };
        }
        return r.json();
      })
      .then((d) => (d.results ?? []) as unknown[])
      .catch((err) => {
        ownersStatus = { status: "network_error", detail: err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160) };
        return [] as unknown[];
      }),
    // ── Tickets ──
    // BUG FIX : on ne hardcode plus le stage "4" (qui ne marche que sur le
    // pipeline ticket par défaut). On compte TOUS les tickets ouverts via
    // hs_pipeline_stage HAS_PROPERTY puis on dérive open/closed via le total
    // ticketsTotal (ecosystem.tickets) - searchClosed.
    // Pour le compte des fermés, on utilise hs_lastclosedate HAS_PROPERTY :
    // un ticket avec une date de fermeture est forcément fermé (universel
    // sur tous les portails et pipelines, pas de hardcode d'ID).
    searchTotal(token, "tickets", {
      filterGroups: [{ filters: [{ propertyName: "hs_lastclosedate", operator: "NOT_HAS_PROPERTY" }] }],
    }, diag, "openTickets"),
    searchTotal(token, "tickets", {
      filterGroups: [{ filters: [{ propertyName: "hs_lastclosedate", operator: "HAS_PROPERTY" }] }],
    }, diag, "closedTickets"),
    // ── Invoices ──
    // BUG FIX : on couvre TOUS les statuts HubSpot Invoices :
    // draft, open, paid, voided, partially_paid (cf. doc HubSpot)
    searchTotal(token, "invoices", {
      filterGroups: [{ filters: [{ propertyName: "hs_invoice_status", operator: "IN", values: ["paid", "partially_paid"] }] }],
    }, diag, "paidInvoices"),
    searchTotal(token, "invoices", {
      filterGroups: [{ filters: [{ propertyName: "hs_invoice_status", operator: "IN", values: ["open", "uncollectible", "draft"] }] }],
    }, diag, "unpaidInvoices"),
    // ── Subscriptions actives ──
    // BUG FIX : "active" SEUL ratait les subs en trialing (cas SaaS standard
    // avec free trial) ET les past_due (paiement échoué mais sub pas annulée).
    // On compte comme "active" TOUT ce qui n'est pas annulé/expiré/paused.
    searchTotal(token, "subscriptions", {
      filterGroups: [{ filters: [{ propertyName: "hs_subscription_status", operator: "IN", values: ["active", "trialing", "past_due"] }] }],
    }, diag, "activeSubscriptions"),
    // ── Ecosystem complet (autres counts) ──
    fetchHubSpotEcosystemCounts(token),
  ]);

  diag.set("ownersCount", ownersStatus);

  const closedTotal = wonDeals + lostDeals;
  const openDealsCount = Math.max(0, totalDeals - closedTotal);
  const opportunitiesCount = lifecycle.oppsLikeCount;
  const leadsCount = lifecycle.leadsLikeCount;
  const customersCount = lifecycle.customersCount;

  return {
    totalDeals,
    wonDeals,
    lostDeals,
    openDeals: openDealsCount,
    closingRate: closedTotal > 0 ? Math.round((wonDeals / closedTotal) * 100) : 0,
    dealsNoNextActivity,
    dealsNoAmount,
    dealsNoCloseDate,
    stagnantDeals: dealsStagnant,
    dealsAtRisk,
    totalPipelineAmount,
    wonAmount,
    totalContacts,
    leadsCount,
    opportunitiesCount,
    customersCount,
    conversionRate: totalContacts > 0 ? Math.round((opportunitiesCount / totalContacts) * 100) : 0,
    orphansCount,
    orphanRate: totalContacts > 0 ? Math.round((orphansCount / totalContacts) * 100) : 0,
    contactsNoPhone,
    contactsNoTitle,
    contactsNoEmail,
    totalCompanies,
    companiesNoIndustry,
    companiesNoRevenue,
    companiesNoDomain,
    lifecycleByStage: lifecycle.byStage,
    pipelines: pipelines.filter((p) => !p.archived),
    ownersCount: ownersList.length,
    // BUG FIX : on prend le vrai total tickets de l'ecosystem (search?limit=1)
    // au lieu de la somme dérivée openTickets + closedTickets, qui pouvait
    // être 0 si le hardcode "stage 4" ratait les pipelines tickets custom.
    totalTickets: ecosystem.tickets,
    openTickets,
    closedTickets,
    totalConversations: ecosystem.conversations,
    feedbackCount: ecosystem.feedbackSubmissions,
    // BUG FIX : on ne fait plus paidInvoices + unpaidInvoices + ecosystem.invoices
    // qui triple-comptait. ecosystem.invoices = total /search?limit=1 sans
    // filter = TOUTES les invoices déjà. C'est la source de vérité.
    totalInvoices: ecosystem.invoices,
    paidInvoices,
    unpaidInvoices,
    totalSubscriptions: ecosystem.subscriptions,
    activeSubscriptions,
    totalQuotes: ecosystem.quotes,
    totalLineItems: ecosystem.lineItems,
    sequencesEnrollments: ecosystem.sequences,
    forecastsCount: ecosystem.forecasts,
    goalsCount: ecosystem.goals,
    leadsObjectCount: ecosystem.leads,
    formsCount: ecosystem.forms,
    marketingCampaignsCount: ecosystem.marketingCampaigns,
    marketingEventsCount: ecosystem.marketingEvents,
    workflowsCount: ecosystem.workflows,
    workflowsActiveCount: ecosystem.workflowsActive,
    listsCount: ecosystem.lists,
    customObjectsCount: ecosystem.customObjects,
    teamsCount: ecosystem.teams,
    appointmentsCount: ecosystem.appointments,
    listingsCount: ecosystem.listings,
    projectsCount: ecosystem.projects,
    usersCount: ecosystem.users,
    ecosystem,
    kpiDiagnostics: Object.fromEntries(diag),
  };
}
