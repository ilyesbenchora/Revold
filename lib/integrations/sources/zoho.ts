/**
 * Minimal Zoho CRM REST API client.
 *
 * Auth: refresh-token grant. We exchange the user-provided refresh_token for
 * a short-lived access_token at the start of every sync.
 *
 * Data center matters: zoho.eu vs zoho.com vs zoho.in.
 */

const ZOHO_DC = (dc: string) => {
  const safe = (dc || "com").trim().toLowerCase();
  return {
    accounts: `https://accounts.zoho.${safe}`,
    api: `https://www.zohoapis.${safe}/crm/v5`,
  };
};

export type ZohoAccount = {
  id: string;
  Account_Name: string;
  Website: string | null;
  Industry: string | null;
};

export type ZohoContact = {
  id: string;
  First_Name: string | null;
  Last_Name: string | null;
  Email: string | null;
  Phone: string | null;
  Account_Name?: { id: string; name: string } | null;
};

export type ZohoDeal = {
  id: string;
  Deal_Name: string;
  Amount: number | null;
  Stage: string;
  Closing_Date: string | null;
  Account_Name?: { id: string; name: string } | null;
};

export async function refreshAccessToken(
  dc: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const url = `${ZOHO_DC(dc).accounts}/oauth/v2/token`;
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${url}?${params}`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Zoho token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Zoho token error: ${data.error || "unknown"}`);
  return data.access_token;
}

async function zohoFetch<T>(dc: string, accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${ZOHO_DC(dc).api}${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(
  dc: string,
  token: string,
  module: string,
  max = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  const perPage = 200;
  while (all.length < max) {
    const res = await zohoFetch<{ data?: T[]; info?: { more_records: boolean } }>(
      dc,
      token,
      `/${module}?page=${page}&per_page=${perPage}`,
    );
    const data = res.data ?? [];
    if (data.length === 0) break;
    all.push(...data);
    if (!res.info?.more_records) break;
    page++;
  }
  return all;
}

export const listZohoAccounts = (dc: string, token: string, max = 1000) =>
  listAll<ZohoAccount>(dc, token, "Accounts", max);

export const listZohoContacts = (dc: string, token: string, max = 2000) =>
  listAll<ZohoContact>(dc, token, "Contacts", max);

export const listZohoDeals = (dc: string, token: string, max = 2000) =>
  listAll<ZohoDeal>(dc, token, "Deals", max);

export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
