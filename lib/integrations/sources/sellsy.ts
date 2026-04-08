/**
 * Minimal Sellsy v2 REST API client.
 * Auth: OAuth2 client_credentials → exchange client_id + client_secret for an access token.
 */

const SELLSY_AUTH = "https://login.sellsy.com/oauth2/access-tokens";
const SELLSY_API = "https://api.sellsy.com/v2";

export type SellsyCompany = {
  id: number;
  name: string;
  email?: string | null;
  website?: string | null;
};

export type SellsyIndividual = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
};

export type SellsyInvoice = {
  id: number;
  number: string | null;
  status: string;       // draft, due, paid, cancelled, ...
  currency: string;
  amounts: { total_incl_tax: string; remaining_to_pay_incl_tax: string };
  date: string | null;
  due_date: string | null;
  paid_at: string | null;
  related: Array<{ type: "company" | "individual"; id: number }>;
};

export async function getSellsyAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(SELLSY_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Sellsy token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Sellsy: no access_token returned");
  return data.access_token;
}

async function sellsyFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${SELLSY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Sellsy ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function listAll<T>(token: string, endpoint: string, max = 1000): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const limit = 100;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await sellsyFetch<{ data?: T[]; pagination?: { count: number } }>(
      token,
      `${endpoint}${sep}limit=${limit}&offset=${offset}`,
    );
    const data = res.data ?? [];
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

export const listSellsyCompanies = (token: string, max = 1000) =>
  listAll<SellsyCompany>(token, "/companies", max);

export const listSellsyIndividuals = (token: string, max = 1000) =>
  listAll<SellsyIndividual>(token, "/individuals", max);

export const listSellsyInvoices = (token: string, max = 2000) =>
  listAll<SellsyInvoice>(token, "/invoices", max);
