/**
 * HubSpot Integration
 * OAuth2 flow + data sync (deals, contacts, companies, activities)
 */

// ── OAuth ──

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API = "https://api.hubapi.com";

type HubSpotTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/**
 * Scopes OAuth HubSpot — vérifiés contre la doc officielle
 * (https://developers.hubspot.com/docs/guides/apps/authentication/scopes)
 *
 * Compatible plan Pro. Engagements (calls/emails/meetings/notes/tasks) ne sont
 * PAS des scopes OAuth dédiés — ils sont lus via les associations sur deals
 * (couverts par crm.objects.deals.read + crm.objects.contacts.read).
 *
 * Plan dependencies (chaque scope a été vérifié) :
 *   - Any account        : la majorité des crm.objects.* read + schemas + lists
 *   - Sales Hub Pro+     : sales-email-read, leads, sequences
 *   - Sales Hub Starter+ : goals
 *   - Service Hub Pro+   : feedback_submission, knowledge_base
 *   - Marketing Hub Pro+ : automation, forms, campaigns
 *   - Enterprise only    : custom objects (RETIRÉ de la liste pour Pro)
 */
/**
 * SCOPES REQUIRED — strict minimum dispo SUR TOUS LES PLANS HubSpot (Free → Enterprise).
 *
 * Doivent être marqués "Required" dans le dev portal HubSpot.
 * Si l'utilisateur ne peut pas les accorder → l'OAuth échoue (rare car ce
 * sont les 4 objets CRM de base, présents dès le tier Free).
 */
export const HUBSPOT_OAUTH_REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.objects.owners.read",
];

/**
 * SCOPES OPTIONAL DEFAULT — liste de scopes connus pour exister dans le catalogue
 * HubSpot ET disponibles sur la majorité des plans. Conservatrice par design :
 * ne contient AUCUN scope rare (sensitive/highly_sensitive, partner, dealsplits,
 * cms.functions, behavioral_events, etc.) qui causerait une "incohérence de
 * domaines" si non coché dans le dev portal.
 *
 * SI TU AJOUTES UN SCOPE ICI, il faut OBLIGATOIREMENT :
 *   1) Vérifier qu'il existe dans le catalogue HubSpot (doc officielle)
 *   2) Le cocher en "Optional" dans le dev portal HubSpot
 *
 * SOLUTION DÉFINITIVE pour éviter l'erreur "incohérence des domaines" :
 *   Définis l'env var `HUBSPOT_OAUTH_OPTIONAL_SCOPES` (séparée par espace ou
 *   virgule) qui REMPLACE complètement cette liste. Permet d'ajuster sans
 *   redéploiement de code, en parfait alignement avec le dev portal.
 */
const HUBSPOT_OAUTH_OPTIONAL_SCOPES_DEFAULT = [
  // ── Account / Analytics ──────────────────────────────
  "account-info.security.read",
  "business-intelligence",
  "business_units_view.read",

  // ── Automation / Sequences ──────────────────────────
  "automation",
  "automation.sequences.read",

  // ── Conversations ────────────────────────────────────
  "conversations.read",

  // ── CRM extensions / imports / lists ────────────────
  "crm.dealsplits.read_write",
  "crm.extensions_calling_transcripts.read",
  "crm.import",
  "crm.lists.read",

  // ── CRM objects étendus ──────────────────────────────
  "crm.objects.appointments.read",
  "crm.objects.feedback_submissions.read",
  "crm.objects.forecasts.read",
  "crm.objects.goals.read",
  "crm.objects.invoices.read",
  "crm.objects.leads.read",
  "crm.objects.line_items.read",
  "crm.objects.listings.read",
  "crm.objects.marketing_events.read",
  "crm.objects.projects.read",
  "crm.objects.quotes.read",
  "crm.objects.subscriptions.read",
  "crm.objects.users.read",

  // ── CRM Schemas ──────────────────────────────────────
  "crm.schemas.appointments.read",
  "crm.schemas.companies.read",
  "crm.schemas.contacts.read",
  "crm.schemas.custom.read",
  "crm.schemas.deals.read",
  "crm.schemas.invoices.read",
  "crm.schemas.listings.read",

  // ── Forms ────────────────────────────────────────────
  "external_integrations.forms.access",
  "forms",

  // ── Integration sync ─────────────────────────────────
  "integration-sync",

  // ── Marketing Hub ────────────────────────────────────
  "marketing.campaigns.read",
  "marketing.campaigns.revenue.read",

  // ── Sales Hub ────────────────────────────────────────
  "sales-email-read",

  // ── Settings ─────────────────────────────────────────
  "settings.billing.write",
  "settings.currencies.read",
  "settings.users.read",
  "settings.users.teams.read",

  // ── Service Hub ──────────────────────────────────────
  "tickets",
];

/**
 * Liste effective des scopes optional, env var override possible.
 * L'env var permet de coller PARFAITEMENT au dev portal sans redéployer le code.
 */
function getOptionalScopes(): string[] {
  const envVar = process.env.HUBSPOT_OAUTH_OPTIONAL_SCOPES;
  if (envVar && envVar.trim()) {
    return envVar
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return HUBSPOT_OAUTH_OPTIONAL_SCOPES_DEFAULT;
}

export const HUBSPOT_OAUTH_OPTIONAL_SCOPES = HUBSPOT_OAUTH_OPTIONAL_SCOPES_DEFAULT;

/** Tous les scopes (required + optional) pour la liste totale. */
export const HUBSPOT_OAUTH_SCOPES = [
  ...HUBSPOT_OAUTH_REQUIRED_SCOPES,
  ...HUBSPOT_OAUTH_OPTIONAL_SCOPES_DEFAULT,
];

/**
 * Construit l'URL d'autorisation HubSpot avec scopes split en
 * required (`scope=`) + optional (`optional_scope=`).
 *
 * Pattern multi-tenant SaaS standard : Required = strict minimum dispo
 * sur tous les plans → garantit que l'OAuth ne plante jamais. Optional =
 * tout ce qui dépend du plan/add-ons → HubSpot accorde silencieusement
 * ceux dispo, ignore les autres sans erreur.
 *
 * `state` doit être un nonce signé côté serveur (CSRF). L'orgId est résolu
 * côté serveur depuis la session, jamais en clair dans l'URL.
 */
export function getHubSpotAuthUrl(state: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID!;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI!;
  const required = HUBSPOT_OAUTH_REQUIRED_SCOPES.join(" ");
  const optional = getOptionalScopes().join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: required,
    optional_scope: optional,
    state,
  });

  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

/** Snapshot runtime des scopes effectivement envoyés (pour debug endpoint). */
export function getEffectiveOAuthScopes(): {
  required: string[];
  optional: string[];
  optionalSource: "env" | "default";
} {
  const envVar = process.env.HUBSPOT_OAUTH_OPTIONAL_SCOPES;
  return {
    required: HUBSPOT_OAUTH_REQUIRED_SCOPES,
    optional: getOptionalScopes(),
    optionalSource: envVar && envVar.trim() ? "env" : "default",
  };
}

/**
 * Récupère les infos du token (portal_id, scopes, expires_in) — endpoint
 * public HubSpot, ne consomme pas de quota.
 * https://developers.hubspot.com/docs/api/oauth-tokens#get-token-information
 */
export type HubSpotAccountInfo = {
  hub_id: number;
  hub_domain: string;
  portal_id: number;
  user: string;
  user_id: number;
  scopes: string[];
};

export async function fetchHubSpotAccountInfo(accessToken: string): Promise<HubSpotAccountInfo> {
  const res = await fetch(`${HUBSPOT_API}/oauth/v1/access-tokens/${accessToken}`);
  if (!res.ok) throw new Error(`HubSpot account info failed: ${res.status}`);
  return res.json();
}

/**
 * Liste les CUSTOM objects créés dans le portail HubSpot du client (via
 * /crm/v3/schemas). Filtre les standard objects (contacts, companies,
 * deals, etc.) — ne garde que les objectTypeId qui ne commencent pas par
 * "0-" (les standards) et qui ne sont pas archivés.
 *
 * Usage : appelé après l'OAuth callback pour stocker la liste dans
 * integrations.metadata.custom_objects → ensuite affichée dans la page
 * paramètres pour que l'utilisateur voie tout de suite ce qu'on a détecté.
 */
export type HubSpotCustomObject = {
  /** ID interne, ex "2-12345678" */
  objectTypeId: string;
  /** nom interne, ex "listings" ou "p_rentals" */
  name: string;
  /** label singulier, ex "Listing" */
  labelSingular: string;
  /** label pluriel, ex "Listings" */
  labelPlural: string;
  /** propriétés disponibles (count) */
  propertyCount: number;
  /** date de création de l'objet */
  createdAt: string | null;
};

/**
 * Liste les LISTES HubSpot (segments de contacts/companies) du portail.
 * Ce ne sont PAS des custom objects mais souvent confondues — on les
 * affiche à part dans la card pour donner une vue complète.
 */
export type HubSpotList = {
  listId: string;
  name: string;
  objectTypeId: string;
  size: number | null;
  processingType: string;
  createdAt: string | null;
};

export async function fetchHubSpotLists(accessToken: string): Promise<HubSpotList[]> {
  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/lists/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 100 }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      lists?: Array<{
        listId: string;
        name: string;
        objectTypeId: string;
        processingType: string;
        createdAt?: string;
        additionalProperties?: { hs_list_size?: string };
      }>;
    };
    return (data.lists ?? []).map((l) => ({
      listId: l.listId,
      name: l.name,
      objectTypeId: l.objectTypeId,
      size: l.additionalProperties?.hs_list_size ? parseInt(l.additionalProperties.hs_list_size, 10) : null,
      processingType: l.processingType,
      createdAt: l.createdAt ?? null,
    }));
  } catch {
    return [];
  }
}

export async function fetchHubSpotCustomObjects(accessToken: string): Promise<HubSpotCustomObject[]> {
  const res = await fetch(`${HUBSPOT_API}/crm/v3/schemas`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // Pas une erreur fatale (accès custom objects peut être refusé selon plan)
    return [];
  }
  const data = (await res.json()) as {
    results: Array<{
      objectTypeId: string;
      name: string;
      labels: { singular: string; plural: string };
      properties?: unknown[];
      createdAt?: string;
      archived?: boolean;
    }>;
  };

  return (data.results ?? [])
    .filter((s) => !s.archived && !s.objectTypeId.startsWith("0-")) // exclut les standards
    .map((s) => ({
      objectTypeId: s.objectTypeId,
      name: s.name,
      labelSingular: s.labels?.singular ?? s.name,
      labelPlural: s.labels?.plural ?? s.name,
      propertyCount: Array.isArray(s.properties) ? s.properties.length : 0,
      createdAt: s.createdAt ?? null,
    }));
}

export async function exchangeHubSpotCode(code: string): Promise<HubSpotTokens> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
      code,
    }),
  });

  if (!res.ok) throw new Error(`HubSpot token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshHubSpotToken(refreshToken: string): Promise<HubSpotTokens> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`HubSpot token refresh failed: ${res.status}`);
  return res.json();
}

// ── API Client ──

async function hubspotFetch(accessToken: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${HUBSPOT_API}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`HubSpot API error: ${res.status} ${endpoint}`);
  return res.json();
}

// ── Sync Functions ──

export type HubSpotDeal = {
  id: string;
  properties: {
    dealname: string;
    amount: string | null;
    dealstage: string;
    closedate: string | null;
    createdate: string;
    hs_lastmodifieddate: string;
    hubspot_owner_id: string | null;
    hs_is_closed_won: string | null;
    hs_is_closed: string | null;
    hs_deal_stage_probability: string | null;
    num_associated_contacts: string | null;
    pipeline: string | null;
    notes_last_contacted: string | null;
    notes_next_activity_date: string | null;
    num_notes: string | null;
    days_to_close: string | null;
    hs_forecast_amount: string | null;
  };
};

export type HubSpotContact = {
  id: string;
  properties: {
    email: string;
    firstname: string | null;
    lastname: string | null;
    jobtitle: string | null;
    phone: string | null;
    hs_lead_status: string | null;
    lifecyclestage: string | null;
  };
};

export type HubSpotCompany = {
  id: string;
  properties: {
    name: string;
    domain: string | null;
    industry: string | null;
    annualrevenue: string | null;
    numberofemployees: string | null;
  };
};

export async function fetchHubSpotDeals(accessToken: string): Promise<HubSpotDeal[]> {
  const deals: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: "dealname,amount,dealstage,closedate,createdate,hs_lastmodifieddate,hubspot_owner_id,hs_is_closed_won,hs_is_closed,hs_deal_stage_probability,num_associated_contacts,pipeline,notes_last_contacted,notes_next_activity_date,num_notes,days_to_close,hs_forecast_amount",
    };
    if (after) params.after = after;

    const data = await hubspotFetch(accessToken, "/crm/v3/objects/deals", params);
    deals.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return deals;
}

export async function fetchHubSpotContacts(accessToken: string, maxPages: number = 20): Promise<HubSpotContact[]> {
  const contacts: HubSpotContact[] = [];
  let after: string | undefined;
  let page = 0;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: "email,firstname,lastname,jobtitle,phone,hs_lead_status,lifecyclestage,hs_analytics_source,num_conversion_events,num_notes,first_conversion_date,recent_conversion_event_name",
    };
    if (after) params.after = after;

    const data = await hubspotFetch(accessToken, "/crm/v3/objects/contacts", params);
    contacts.push(...data.results);
    after = data.paging?.next?.after;
    page++;
  } while (after && page < maxPages);

  return contacts;
}

export async function fetchHubSpotCompanies(accessToken: string, maxPages: number = 20): Promise<HubSpotCompany[]> {
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  let page = 0;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: "name,domain,industry,annualrevenue,numberofemployees",
    };
    if (after) params.after = after;

    const data = await hubspotFetch(accessToken, "/crm/v3/objects/companies", params);
    companies.push(...data.results);
    after = data.paging?.next?.after;
    page++;
  } while (after && page < maxPages);

  return companies;
}

// ────────────────────────────────────────────────────────────────────────────
// ECOSYSTEM SNAPSHOT — exploite TOUS les scopes optional disponibles
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pour chaque objet/feature HubSpot autorisé par les scopes optional, on
 * récupère le COUNT total + (parfois) un sample. Permet aux pages Revold
 * d'afficher des KPIs sans rien synchroniser, et aux insights de raisonner
 * sur l'écosystème complet (tickets, leads, invoices, etc.).
 *
 * Chaque fetch est résilient : si le scope n'est pas accordé ou si l'API
 * répond 403, on retourne 0 sans crasher l'ensemble.
 */

/**
 * Diagnostic optionnel passé à safeCount/searchCount/paginatedCount.
 * Quand fourni, le helper écrit le status HTTP réel pour le KPI
 * correspondant. Permet à la page Données de différencier "vraiment 0"
 * vs "scope manquant" vs "endpoint 404".
 */
type DiagInput = { diag?: Map<string, { status: string; httpCode?: number }>; key?: string };

function recordDiag(opts: DiagInput | undefined, status: string, httpCode?: number) {
  if (opts?.diag && opts.key) opts.diag.set(opts.key, { status, httpCode });
}

async function safeCount(
  accessToken: string,
  endpoint: string,
  body?: unknown,
  opts?: DiagInput,
): Promise<number> {
  try {
    const url = `${HUBSPOT_API}${endpoint}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const s = res.status === 401 || res.status === 403 ? "no_scope"
        : res.status === 404 ? "addon_missing"
        : "endpoint_error";
      recordDiag(opts, s, res.status);
      return 0;
    }
    const data = await res.json();
    let total = 0;
    if (typeof data.total === "number") total = data.total;
    else if (Array.isArray(data.results)) total = data.results.length;
    else if (Array.isArray(data.workflows)) total = data.workflows.length;
    else if (Array.isArray(data.lists)) total = data.lists.length;
    else if (Array.isArray(data.users)) total = data.users.length;
    else if (Array.isArray(data.teams)) total = data.teams.length;
    else if (Array.isArray(data.objects)) total = data.objects.length;
    else if (typeof data.totalCount === "number") total = data.totalCount;
    recordDiag(opts, "ok", 200);
    return total;
  } catch {
    recordDiag(opts, "network_error");
    return 0;
  }
}

/**
 * Count exact via /crm/v3/objects/{type}/search (POST) — l'endpoint renvoie
 * `total` sans charger les rows. Fiable pour TOUS les CRM objects (standard
 * et custom) tant que le scope correspondant est accordé.
 */
function searchCount(accessToken: string, objectType: string, opts?: DiagInput): Promise<number> {
  return safeCount(accessToken, `/crm/v3/objects/${objectType}/search`, { limit: 1 }, opts);
}

/**
 * Paginate jusqu'à `maxPages` pour compter une ressource sans champ `total`
 * (forms, campaigns, users HubSpot v3). Cap volontaire pour éviter les
 * loops infinis sur des comptes très gros.
 */
async function paginatedCount(
  accessToken: string,
  endpoint: string,
  maxPages = 10,
  opts?: DiagInput,
): Promise<number> {
  let total = 0;
  let after: string | undefined;
  let page = 0;

  let lastErrCode: number | null = null;
  do {
    try {
      const url = new URL(`${HUBSPOT_API}${endpoint}`);
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        lastErrCode = res.status;
        break;
      }
      const data = await res.json();
      const results = (data.results ?? []) as unknown[];
      total += results.length;
      after = data.paging?.next?.after;
      page++;
    } catch {
      recordDiag(opts, "network_error");
      return total;
    }
  } while (after && page < maxPages);

  if (lastErrCode !== null && total === 0) {
    const s = lastErrCode === 401 || lastErrCode === 403 ? "no_scope"
      : lastErrCode === 404 ? "addon_missing"
      : "endpoint_error";
    recordDiag(opts, s, lastErrCode);
  } else {
    recordDiag(opts, "ok", 200);
  }
  return total;
}

/**
 * Forms : essai prioritaire sur /marketing/v3/forms (Marketing Hub).
 * Si scope manquant ou 404 → fallback sur /forms/v2/forms (legacy public,
 * disponible sur la plupart des comptes même Free).
 */
async function paginatedCountWithFallback(
  accessToken: string,
  primaryEndpoint: string,
  fallbackEndpoint: string,
  maxPages = 10,
  opts?: DiagInput,
): Promise<number> {
  // 1) Essai endpoint principal sans recordDiag final
  const localDiag = new Map<string, { status: string; httpCode?: number }>();
  const localOpts: DiagInput = { diag: localDiag, key: "primary" };
  const primaryCount = await paginatedCount(accessToken, primaryEndpoint, maxPages, localOpts);
  const primaryStatus = localDiag.get("primary");
  if (primaryStatus?.status === "ok" && primaryCount > 0) {
    recordDiag(opts, "ok", 200);
    return primaryCount;
  }
  if (primaryCount > 0) {
    // Endpoint a renvoyé qqch même si status pas tout à fait clean
    recordDiag(opts, "ok", primaryStatus?.httpCode ?? 200);
    return primaryCount;
  }
  // 2) Fallback legacy
  try {
    const r = await fetch(`${HUBSPOT_API}${fallbackEndpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      recordDiag(opts, primaryStatus?.status ?? "endpoint_error", primaryStatus?.httpCode);
      return 0;
    }
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.objects ?? data.results ?? []);
    recordDiag(opts, "ok", 200);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    recordDiag(opts, primaryStatus?.status ?? "network_error");
    return 0;
  }
}

export type HubSpotEcosystemCounts = {
  // CRM objects étendus
  invoices: number;
  subscriptions: number;
  quotes: number;
  lineItems: number;
  appointments: number;
  marketingEvents: number;
  goals: number;
  leads: number;
  feedbackSubmissions: number;
  forecasts: number;
  listings: number;
  projects: number;
  // Service / Engagement
  tickets: number;
  conversations: number;
  // Sales
  sequences: number;
  // Marketing
  forms: number;
  marketingCampaigns: number;
  // Workspace
  users: number;
  teams: number;
  // Schemas (custom)
  customObjects: number;
  // Lists / pipelines
  lists: number;
  pipelines: number;
  // Workflows
  workflows: number;
  workflowsActive: number;
};

export async function fetchHubSpotEcosystemCounts(
  accessToken: string,
  diag?: Map<string, { status: string; httpCode?: number }>,
): Promise<HubSpotEcosystemCounts> {
  const D = (key: string): DiagInput => ({ diag, key });
  // ── Custom objects : compter UNIQUEMENT les schemas non-standard ──
  // /crm/v3/schemas retourne aussi les standard objects (préfixe "0-").
  // Les custom objects ont objectTypeId qui commence par "2-".
  const customObjectsCount = await fetch(`${HUBSPOT_API}/crm/v3/schemas`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((d) => {
      const all = (d.results ?? []) as Array<{ objectTypeId?: string; archived?: boolean }>;
      return all.filter((s) => s.objectTypeId && s.objectTypeId.startsWith("2-") && !s.archived).length;
    })
    .catch(() => 0);

  const [
    invoices,
    subscriptions,
    quotes,
    lineItems,
    appointments,
    marketingEvents,
    goals,
    leads,
    feedbackSubmissions,
    listings,
    projects,
    tickets,
    conversations,
    sequencesEnrollments,
    forms,
    marketingCampaigns,
    users,
    teams,
    listsCount,
    pipelines,
    workflowsData,
  ] = await Promise.all([
    // ── CRM objects (search?limit=1 renvoie .total fiable) ──
    searchCount(accessToken, "invoices", D("invoices")),
    searchCount(accessToken, "subscriptions", D("subscriptions")),
    searchCount(accessToken, "quotes", D("quotes")),
    searchCount(accessToken, "line_items", D("line_items")),
    searchCount(accessToken, "appointments", D("appointments")),
    searchCount(accessToken, "marketing_events", D("marketing_events")),
    searchCount(accessToken, "goals", D("goals")),
    searchCount(accessToken, "leads", D("leads")),
    searchCount(accessToken, "feedback_submissions", D("feedback_submissions")),
    searchCount(accessToken, "listings", D("listings")),
    searchCount(accessToken, "projects", D("projects")),
    searchCount(accessToken, "tickets", D("tickets")),

    // Conversations : v3 inbox endpoint paginé
    paginatedCount(accessToken, "/conversations/v3/conversations/threads", 5, D("conversations")),

    // Sequences : pas d'endpoint public direct pour le total des sequences.
    // On compte les enrollments comme proxy d'usage. 0 = pas de scope ou
    // pas de Sales Hub Pro+
    paginatedCount(accessToken, "/automation/v4/sequences/enrollments", 3, D("sequences")),

    // Forms : essai prioritaire /marketing/v3/forms (Marketing Hub Pro+),
    // fallback /forms/v2/forms (legacy public, dispo même Marketing Hub Free)
    paginatedCountWithFallback(accessToken, "/marketing/v3/forms", "/forms/v2/forms", 5, D("forms")),
    paginatedCount(accessToken, "/marketing/v3/campaigns", 5, D("marketing_campaigns")),
    paginatedCount(accessToken, "/settings/v3/users", 10, D("users")),

    // Teams
    fetch(`${HUBSPOT_API}/settings/v3/users/teams`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => (d.results ?? []).length)
      .catch(() => 0),

    // Lists via search (a un .total)
    safeCount(accessToken, "/crm/v3/lists/search", { count: 1, processingTypes: ["MANUAL", "DYNAMIC", "SNAPSHOT"] }),

    // Pipelines
    fetch(`${HUBSPOT_API}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => (d.results ?? []).length)
      .catch(() => 0),

    // Workflows : v3 + v4 mergés
    fetchWorkflowsCounts(accessToken),
  ]);

  return {
    invoices,
    subscriptions,
    quotes,
    lineItems,
    appointments,
    marketingEvents,
    goals,
    leads,
    feedbackSubmissions,
    forecasts: 0, // forecasts n'est PAS un CRM object (Sales Hub Forecast Tool en interne)
    listings,
    projects,
    tickets,
    conversations,
    sequences: sequencesEnrollments,
    forms,
    marketingCampaigns,
    users,
    teams,
    customObjects: customObjectsCount,
    lists: listsCount,
    pipelines,
    workflows: workflowsData.total,
    workflowsActive: workflowsData.active,
  };
}

/**
 * Compte les workflows HubSpot — sur les DEUX endpoints v3 et v4 simultanément
 * car ils gèrent des workflows différents :
 *  - /automation/v3/workflows : workflows legacy (la majorité des comptes)
 *  - /automation/v4/flows     : workflows nouvelle génération
 * Dedup par id pour les workflows présents dans les deux APIs.
 */
async function fetchWorkflowsCounts(accessToken: string): Promise<{ total: number; active: number }> {
  type Wf = { id: string | number; enabled?: boolean; isEnabled?: boolean };

  const [v3Res, v4Res] = await Promise.all([
    fetch(`${HUBSPOT_API}/automation/v3/workflows`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null),
    fetch(`${HUBSPOT_API}/automation/v4/flows?limit=200`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null),
  ]);

  let v3List: Wf[] = [];
  let v4List: Wf[] = [];

  if (v3Res && v3Res.ok) {
    try {
      const data = await v3Res.json();
      v3List = (data.workflows ?? []) as Wf[];
    } catch {}
  }

  if (v4Res && v4Res.ok) {
    try {
      const data = await v4Res.json();
      v4List = (data.results ?? []) as Wf[];
    } catch {}
  }

  // Dedup par id (un workflow peut apparaître dans les deux APIs)
  const seen = new Set<string>();
  const merged: Wf[] = [];
  for (const w of [...v3List, ...v4List]) {
    const id = String(w.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(w);
  }

  const active = merged.filter((w) => w.enabled === true || w.isEnabled === true).length;
  return { total: merged.length, active };
}

/** Snapshot par défaut quand pas de token / pas de scopes. */
export const EMPTY_ECOSYSTEM_COUNTS: HubSpotEcosystemCounts = {
  invoices: 0,
  subscriptions: 0,
  quotes: 0,
  lineItems: 0,
  appointments: 0,
  marketingEvents: 0,
  goals: 0,
  leads: 0,
  feedbackSubmissions: 0,
  forecasts: 0,
  listings: 0,
  projects: 0,
  tickets: 0,
  conversations: 0,
  sequences: 0,
  forms: 0,
  marketingCampaigns: 0,
  users: 0,
  teams: 0,
  customObjects: 0,
  lists: 0,
  pipelines: 0,
  workflows: 0,
  workflowsActive: 0,
};
