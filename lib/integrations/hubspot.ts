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

/** Scopes nécessaires pour l'analyse Revold complète + roadmap 6 mois.
 *  Doivent EXACTEMENT matcher la liste "Required" dans l'app HubSpot du portail développeur.
 *
 *  Logique de sélection : chaque scope a un cas d'usage concret côté Revold.
 *  On ne prend PAS les scopes esotériques (carts, listings, forecasts HubSpot,
 *  transcripts) qui (a) effraient les prospects à l'écran de consent et
 *  (b) rajoutent une responsabilité RGPD inutile.
 *
 *  Plan dependencies :
 *   - Free / Starter            : tous les crm.objects.* + schemas + lists OK
 *   - Sales Hub Pro+            : sales-email-read, sequences, dealsplits, quotes
 *   - Sales Hub Enterprise      : crm.objects.leads.read, dealsplits
 *   - Service Hub               : tickets
 *   - Marketing Hub Pro+ / Ops  : automation, forms, marketing.campaigns.revenue
 *   - HubSpot Invoices add-on   : crm.objects.invoices.read
 *   - HubSpot Meetings (built-in): crm.objects.appointments.read
 */
export const HUBSPOT_OAUTH_SCOPES = [
  // ── CRM core (tous plans) ─────────────────────────────
  "crm.objects.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.owners.read",
  "crm.objects.line_items.read",
  "crm.objects.leads.read",
  "crm.objects.custom.read",        // accès lecture aux DONNÉES des custom objects
  "crm.objects.listings.read",      // built-in HubSpot Listings + alias pour custom "Listings"
  "crm.lists.read",
  "crm.schemas.deals.read",
  "crm.schemas.contacts.read",
  "crm.schemas.companies.read",
  "crm.schemas.custom.read",        // SCHÉMAS des custom objects (pour les détecter à la connexion)

  // ── Engagements & activité ────────────────────────────
  "crm.objects.appointments.read",
  "crm.schemas.appointments.read",
  "sales-email-read",

  // ── Workflows & automation (Marketing/Ops Pro+) ───────
  "automation",
  "automation.sequences.read",

  // ── Service Hub ───────────────────────────────────────
  "tickets",

  // ── Marketing & attribution ───────────────────────────
  "forms",
  "crm.objects.marketing_events.read",
  "marketing.campaigns.revenue.read",

  // ── Revenue / facturation HubSpot ─────────────────────
  "crm.objects.invoices.read",
  "crm.objects.quotes.read",
  "crm.dealsplits.read_write",

  // ── Settings (structure équipes pour rollups) ─────────
  "settings.users.read",
  "settings.users.teams.read",

  // ── Méta-données portail ──────────────────────────────
  "account-info.security.read",
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
