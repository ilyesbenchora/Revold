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

export function getHubSpotAuthUrl(orgId: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID!;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI!;
  const scopes = [
    "crm.objects.deals.read",
    "crm.objects.contacts.read",
    "crm.objects.companies.read",
    "crm.objects.owners.read",
    "sales-email-read",
  ].join(" ");

  return `${HUBSPOT_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${orgId}`;
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
      properties: "dealname,amount,dealstage,closedate,createdate,hs_lastmodifieddate,hubspot_owner_id,hs_is_closed_won,hs_is_closed,hs_deal_stage_probability,num_associated_contacts,pipeline",
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
      properties: "email,firstname,lastname,jobtitle,phone,hs_lead_status,lifecyclestage",
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
