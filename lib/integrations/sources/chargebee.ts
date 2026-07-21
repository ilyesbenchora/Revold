/**
 * Minimal Chargebee client.
 * Auth: HTTP Basic — API key as username, empty password.
 * Doc: https://apidocs.chargebee.com/docs/api
 *
 * Les listes v2 paginent par offset opaque : { list: [{ customer: {...} }],
 * next_offset } — chaque item est enveloppé sous le nom de la ressource.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export type ChargebeeCustomer = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  billing_address?: { company?: string | null } | null;
  [key: string]: unknown;
};

export type ChargebeeInvoice = {
  id: string;
  customer_id?: string | null;
  status?: string | null;      // paid, posted, payment_due, not_paid, voided, pending
  currency_code?: string | null;
  total?: number | null;       // cents
  amount_paid?: number | null;
  amount_due?: number | null;
  date?: number | null;        // epoch seconds
  due_date?: number | null;
  paid_at?: number | null;
  [key: string]: unknown;
};

export type ChargebeeSubscription = {
  id: string;
  customer_id?: string | null;
  status?: string | null;      // active, in_trial, cancelled, non_renewing, paused, future
  currency_code?: string | null;
  billing_period?: number | null;
  billing_period_unit?: string | null; // day, week, month, year
  current_term_start?: number | null;
  current_term_end?: number | null;
  started_at?: number | null;
  cancelled_at?: number | null;
  plan_amount?: number | null; // cents (plans legacy)
  subscription_items?: Array<{ amount?: number | null; unit_price?: number | null; quantity?: number | null }> | null;
  [key: string]: unknown;
};

async function cbList<T>(
  site: string,
  apiKey: string,
  resource: string,
  max = 1000,
): Promise<T[]> {
  const auth = Buffer.from(`${apiKey.trim()}:`).toString("base64");
  const all: T[] = [];
  let offset: string | null = null;
  while (all.length < max) {
    const params = new URLSearchParams({ limit: "100" });
    if (offset) params.set("offset", offset);
    const res = await fetch(`https://${chargebeeHost(site)}/api/v2/${resource}?${params}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Chargebee ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { list?: Array<Record<string, T>>; next_offset?: string | null };
    // Chaque item est enveloppé : { customer: {...} } / { invoice: {...} }…
    const singular = resource.replace(/s$/, "");
    for (const item of body.list ?? []) all.push(item[singular] ?? (Object.values(item)[0] as T));
    if (!body.next_offset) break;
    offset = body.next_offset;
  }
  return all;
}

export const listChargebeeCustomers = (site: string, apiKey: string, max = 1000) =>
  cbList<ChargebeeCustomer>(site, apiKey, "customers", max);

export const listChargebeeInvoices = (site: string, apiKey: string, max = 2000) =>
  cbList<ChargebeeInvoice>(site, apiKey, "invoices", max);

export const listChargebeeSubscriptions = (site: string, apiKey: string, max = 1000) =>
  cbList<ChargebeeSubscription>(site, apiKey, "subscriptions", max);

/** MRR d'un abonnement Chargebee en unités majeures (EUR), au prorata mensuel. */
export function computeChargebeeMrr(sub: ChargebeeSubscription): number {
  const cents =
    (sub.subscription_items ?? []).reduce(
      (s, it) => s + (it.amount ?? (it.unit_price ?? 0) * (it.quantity ?? 1)),
      0,
    ) || sub.plan_amount || 0;
  const period = sub.billing_period ?? 1;
  const monthly =
    sub.billing_period_unit === "year" ? 1 / (12 * period) :
    sub.billing_period_unit === "week" ? 4.345 / period :
    sub.billing_period_unit === "day" ? 30 / period :
    1 / period; // month (défaut)
  return Math.round(cents * monthly) / 100;
}

/** Normalise le site Chargebee (`acme` → `acme.chargebee.com`). */
function chargebeeHost(site: string): string {
  const s = site.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return s.includes(".") ? s : `${s}.chargebee.com`;
}

/** Valide le couple site + clé API via un appel authentifié minimal. */
export async function pingChargebee(site: string, apiKey: string): Promise<boolean> {
  if (!site?.trim() || !apiKey?.trim()) return false;
  try {
    const auth = Buffer.from(`${apiKey.trim()}:`).toString("base64");
    const res = await fetch(`https://${chargebeeHost(site)}/api/v2/subscriptions?limit=1`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
