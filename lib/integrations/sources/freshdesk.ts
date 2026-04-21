/**
 * Minimal Freshdesk REST API client.
 * Auth: Basic auth using API key as username, "X" as password.
 */

const FD_BASE = (subdomain: string) => `https://${subdomain}.freshdesk.com/api/v2`;

export type FreshdeskContact = {
  id: number;
  email: string | null;
  name: string;
  phone: string | null;
  company_id: number | null;
};

export type FreshdeskCompany = {
  id: number;
  name: string;
  domains: string[];
};

export type FreshdeskTicket = {
  id: number;
  subject: string | null;
  status: number; // 2=open 3=pending 4=resolved 5=closed
  priority: number; // 1=low 2=medium 3=high 4=urgent
  source: number; // 1=email 2=portal 3=phone ...
  requester_id: number;
  company_id: number | null;
  responder_id: number | null;
  created_at: string;
  updated_at: string;
};

function basicAuth(apiKey: string): string {
  return Buffer.from(`${apiKey}:X`).toString("base64");
}

async function fdFetch<T>(subdomain: string, apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${FD_BASE(subdomain)}${path}`, {
    headers: {
      Authorization: `Basic ${basicAuth(apiKey)}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Freshdesk ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(
  subdomain: string,
  apiKey: string,
  endpoint: string,
  max = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const data = await fdFetch<T[]>(
      subdomain,
      apiKey,
      `${endpoint}${sep}per_page=100&page=${page}`,
    );
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

const PRIORITY_MAP: Record<number, string> = { 1: "low", 2: "normal", 3: "high", 4: "urgent" };
const STATUS_MAP: Record<number, string> = { 2: "open", 3: "pending", 4: "closed", 5: "closed" };
const SOURCE_MAP: Record<number, string> = { 1: "email", 2: "web", 3: "phone", 7: "chat" };

/**
 * Validate Freshdesk creds via /agents/me. Catches bad subdomain + bad key.
 */
export async function pingFreshdesk(subdomain: string, apiKey: string): Promise<boolean> {
  try {
    await fdFetch(subdomain, apiKey, "/agents/me");
    return true;
  } catch {
    return false;
  }
}

export const listFreshdeskContacts = (sub: string, key: string, max = 1000) =>
  listAll<FreshdeskContact>(sub, key, "/contacts", max);

export const listFreshdeskCompanies = (sub: string, key: string, max = 500) =>
  listAll<FreshdeskCompany>(sub, key, "/companies", max);

export const listFreshdeskTickets = (sub: string, key: string, max = 1000) =>
  listAll<FreshdeskTicket>(sub, key, "/tickets?include=requester", max);

export { PRIORITY_MAP, STATUS_MAP, SOURCE_MAP };
