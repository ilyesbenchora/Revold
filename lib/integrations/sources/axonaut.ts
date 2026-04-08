/**
 * Minimal Axonaut REST API client.
 * Auth: API key in `userApiKey` header.
 */

const AXO_API = "https://axonaut.com/api/v2";

export type AxonautCompany = {
  id: number;
  name: string;
  email?: string | null;
  website?: string | null;
};

export type AxonautInvoice = {
  id: number;
  number: string | null;
  status: string;             // draft, sent, paid, late, ...
  currency: string;
  total_amount: number;
  paid_amount: number;
  date: string | null;
  due_date: string | null;
  paid_date: string | null;
  company_id: number | null;
};

async function axoFetch<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${AXO_API}${path}`, {
    headers: { userApiKey: apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Axonaut ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(apiKey: string, endpoint: string, max = 1000): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const data = await axoFetch<T[]>(apiKey, `${endpoint}${sep}page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 50) break;
    page++;
  }
  return all;
}

export const listAxonautCompanies = (key: string, max = 1000) =>
  listAll<AxonautCompany>(key, "/companies", max);

export const listAxonautInvoices = (key: string, max = 2000) =>
  listAll<AxonautInvoice>(key, "/invoices", max);
