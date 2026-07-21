/**
 * Minimal Pennylane REST API client.
 * Auth: Bearer API token.
 * Doc: https://pennylane.readme.io/reference/
 */

const PL_API = "https://app.pennylane.com/api/external/v1";

// Timeout par requête HTTP. SANS ça, un endpoint Pennylane qui stalle (typique
// des endpoints v2 non activés pour le plan/token) fait attendre `fetch`
// indéfiniment → le Promise.all du connecteur ne se résout jamais et la sync
// « ne se termine jamais ». On coupe chaque requête à 20 s.
const REQUEST_TIMEOUT_MS = 20_000;

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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    const res = await plFetch<Record<string, unknown> & { total_pages?: number }>(
      token,
      `${endpoint}${sep}page=${page}&per_page=100`,
    );
    // Pennylane v1 nomme le tableau d'après la ressource ({ customers: [...] },
    // { invoices: [...] }) — on prend le premier tableau de la réponse, avec
    // data/items en secours (v2 & autres shapes).
    const data = (
      (res.data as T[] | undefined) ??
      (res.items as T[] | undefined) ??
      (Object.values(res).find(Array.isArray) as T[] | undefined) ??
      []
    );
    if (data.length === 0) break;
    all.push(...data);
    if (res.total_pages && page >= res.total_pages) break;
    if (data.length < 100) break;
    page++;
  }
  return all;
}

/** Validate the Pennylane API token (smallest authenticated call). */
export async function pingPennylane(token: string): Promise<boolean> {
  try {
    await plFetch(token, "/customers?per_page=1");
    return true;
  } catch {
    return false;
  }
}

export const listPennylaneCustomers = (token: string, max = 1000) =>
  listAll<PennylaneCustomer>(token, "/customers", max);

export const listPennylaneInvoices = (token: string, max = 2000) =>
  listAll<PennylaneInvoice>(token, "/customer_invoices", max);

/** Factures FOURNISSEURS (décaissements) — même shape que les factures clients. */
export const listPennylaneSupplierInvoices = (token: string, max = 2000) =>
  listAll<PennylaneInvoice>(token, "/supplier_invoices", max).catch(() => [] as PennylaneInvoice[]);

// ── API v2 (transactions bancaires + comptes) ──────────────────────────────
// Pagination par curseur : { items, has_more, next_cursor }.

const PL_API_V2 = "https://app.pennylane.com/api/external/v2";

export type PennylaneTransaction = {
  id: number;
  label: string | null;
  amount: string;          // signé : >0 encaissement, <0 décaissement
  fee: string | null;
  currency: string;
  date: string | null;
  bank_account?: { id: number } | null;
  /** Catégorisation analytique Pennylane (weight = part de la transaction). */
  categories?: Array<{ id: number; label: string | null; weight?: number | string | null; category_group?: { id: number; label?: string | null } | null }> | null;
};

export type PennylaneBankAccount = {
  id: number;
  name: string | null;
  currency: string;
  balance: string;         // solde réel du compte
};

async function listAllV2<T>(token: string, endpoint: string, max = 5000): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `${PL_API_V2}${endpoint}${sep}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Pennylane v2 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { items?: T[]; has_more?: boolean; next_cursor?: string | null };
    const items = j.items ?? [];
    all.push(...items);
    if (!j.has_more || !j.next_cursor || items.length === 0) break;
    cursor = j.next_cursor;
  }
  return all;
}

/** Transactions bancaires (v2). Résout [] si l'endpoint est indisponible. */
export const listPennylaneTransactions = (token: string, max = 5000) =>
  listAllV2<PennylaneTransaction>(token, "/transactions", max).catch(() => [] as PennylaneTransaction[]);

/** Comptes bancaires + soldes réels (v2). Résout [] si indisponible. */
export const listPennylaneBankAccounts = (token: string) =>
  listAllV2<PennylaneBankAccount>(token, "/bank_accounts", 100).catch(() => [] as PennylaneBankAccount[]);

export type PennylaneLedgerLine = {
  id: number;
  label: string | null;
  debit: string;           // montants en string
  credit: string;
  date: string | null;
  ledger_account?: { id: number; number?: string | null } | null;
};

export type PennylaneLedgerAccount = {
  id: number;
  number: string | null;   // numéro PCG (ex : 706000)
  label: string | null;
};

/**
 * Lignes d'écritures comptables (v2) — débit/crédit par compte. Sert à
 * RECONSTRUIRE la balance et le P&L (trial_balance est 403 pour les clés
 * entreprise). Résout [] si indisponible.
 */
export const listPennylaneLedgerLines = (token: string, max = 10000) =>
  listAllV2<PennylaneLedgerLine>(token, "/ledger_entry_lines", max).catch(() => [] as PennylaneLedgerLine[]);

/** Plan de comptes (v2) — pour libeller la balance. Résout [] si indisponible. */
export const listPennylaneLedgerAccounts = (token: string, max = 2000) =>
  listAllV2<PennylaneLedgerAccount>(token, "/ledger_accounts", max).catch(() => [] as PennylaneLedgerAccount[]);
