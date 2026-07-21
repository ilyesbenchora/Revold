/**
 * Minimal Sage Accounting client (validation only for now).
 * Auth: Bearer access token (OAuth2 Sage Business Cloud Accounting).
 * Doc: https://developer.sage.com/accounting/reference/
 *
 * Note : les access tokens Sage sont de courte durée (~5 min). La validation
 * à la connexion vérifie le token fourni ; un connecteur de sync dédié devra
 * gérer le refresh (client_id/client_secret/refresh_token) le moment venu.
 */

const REQUEST_TIMEOUT_MS = 15_000;

const SAGE_API = "https://api.accounting.sage.com/v3.1";

export type SageContact = {
  id: string;
  displayed_as?: string | null;
  name?: string | null;
  email?: string | null;
  reference?: string | null;
  tax_number?: string | null;        // N° TVA
  registered_number?: string | null; // SIREN/SIRET selon le pays
  main_contact_person?: { email?: string | null } | null;
  [key: string]: unknown;
};

export type SageSalesInvoice = {
  id: string;
  displayed_as?: string | null;
  invoice_number?: string | null;
  contact?: { id?: string | null } | null;
  date?: string | null;
  due_date?: string | null;
  total_amount?: number | string | null;
  outstanding_amount?: number | string | null;
  status?: { id?: string | null; displayed_as?: string | null } | null; // PAID, UNPAID, PART_PAID, VOID
  currency?: { id?: string | null } | null;
  [key: string]: unknown;
};

/** Liste paginée Sage : { $items: [...], $next: "/path?page=2" }. */
async function sageList<T>(accessToken: string, resource: string, max = 2000): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < max) {
    const res = await fetch(
      `${SAGE_API}/${resource}?attributes=all&items_per_page=100&page=${page}`,
      {
        headers: { Authorization: `Bearer ${accessToken.trim()}`, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (res.status === 401) {
      throw new Error(
        "Sage 401 : access token expiré (les tokens Sage durent ~5 min). Regénérez un token depuis le Developer Portal et reconnectez l'outil juste avant de synchroniser.",
      );
    }
    if (!res.ok) throw new Error(`Sage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { $items?: T[]; $next?: string | null };
    const items = body.$items ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (!body.$next) break;
    page++;
  }
  return all;
}

export const listSageContacts = (token: string, max = 1000) =>
  sageList<SageContact>(token, "contacts", max);

export const listSageSalesInvoices = (token: string, max = 2000) =>
  sageList<SageSalesInvoice>(token, "sales_invoices", max);

/** Valide l'access token Sage via un appel authentifié minimal (/user). */
export async function pingSage(accessToken: string): Promise<boolean> {
  if (!accessToken?.trim()) return false;
  try {
    const res = await fetch("https://api.accounting.sage.com/v3.1/user", {
      headers: { Authorization: `Bearer ${accessToken.trim()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
