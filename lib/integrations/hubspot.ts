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
export const HUBSPOT_OAUTH_SCOPES = [
  // ── CRM core (any account) ────────────────────────────
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.objects.owners.read",
  "crm.objects.users.read",
  "crm.objects.line_items.read",
  "crm.objects.appointments.read",

  // ── CRM Schemas (any account) ─────────────────────────
  "crm.schemas.contacts.read",
  "crm.schemas.companies.read",
  "crm.schemas.deals.read",
  "crm.schemas.appointments.read",
  "crm.schemas.invoices.read",

  // ── Lists ─────────────────────────────────────────────
  "crm.lists.read",

  // ── Sales Hub (Pro+) ──────────────────────────────────
  "crm.objects.leads.read",       // Sales Hub Pro+
  "crm.objects.quotes.read",      // any account
  "crm.objects.goals.read",       // Sales Hub Starter+
  "sales-email-read",             // Sales Hub Pro+ — engagement email counters
  "automation.sequences.read",    // Sales/Service Hub Pro+

  // ── Revenue / Facturation HubSpot ────────────────────
  "crm.objects.invoices.read",
  "crm.objects.subscriptions.read",

  // ── Service Hub ──────────────────────────────────────
  "tickets",
  "conversations.read",
  // Note: feedback_submission scope retiré (variante singular/plural non
  // disponible dans le dev portal HubSpot Pro standard). Les données NPS/
  // CSAT restent accessibles via tickets + custom properties.

  // ── Marketing Hub Pro+ ───────────────────────────────
  "forms",
  "automation",
  "marketing.campaigns.revenue.read",
  "crm.objects.marketing_events.read",

  // ── Settings & Admin (any account) ───────────────────
  "settings.users.read",
  "settings.users.teams.read",
  "settings.currencies.read",

  // ── Account meta ─────────────────────────────────────
  "account-info.security.read",

  // ── Analytics ────────────────────────────────────────
  "business-intelligence",        // any account — analytics general
];

/**
 * Construit l'URL d'autorisation HubSpot.
 * `state` doit être un nonce signé côté serveur (CSRF) — on ne met PAS l'orgId
 * en clair dedans, l'orgId est résolu côté serveur depuis la session.
 */
export function getHubSpotAuthUrl(state: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID!;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI!;
  const scopes = HUBSPOT_OAUTH_SCOPES.join(" ");

  return `${HUBSPOT_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
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
