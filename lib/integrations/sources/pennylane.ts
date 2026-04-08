/**
 * Minimal Pennylane REST API client.
 * Auth: Bearer API token.
 * Doc: https://pennylane.readme.io/reference/
 */

const PL_API = "https://app.pennylane.com/api/external/v1";

export type PennylaneCustomer = {
  id: number;
  source_id: string | null;
  name: string;
  emails: string[] | null;
  phone: string | null;
};

export type PennylaneInvoice = {
  id: number;
  invoice_number: string | null;
  status: string;        // draft, sent, paid, ...
  currency: string;
  amount: string;        // pennylane returns strings
  remaining_amount: string;
  date: string | null;
  deadline: string | null;
  paid_at: string | null;
  customer?: { id: number };
};

async function plFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${PL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Pennylane ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(token: string, endpoint: string, max = 1000): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await plFetch<{ data?: T[]; items?: T[]; total_pages?: number }>(
      token,
      `${endpoint}${sep}page=${page}&per_page=100`,
    );
    const data = res.data ?? res.items ?? [];
    if (data.length === 0) break;
    all.push(...data);
    if (res.total_pages && page >= res.total_pages) break;
    if (data.length < 100) break;
    page++;
  }
  return all;
}

export const listPennylaneCustomers = (token: string, max = 1000) =>
  listAll<PennylaneCustomer>(token, "/customers", max);

export const listPennylaneInvoices = (token: string, max = 2000) =>
  listAll<PennylaneInvoice>(token, "/customer_invoices", max);
