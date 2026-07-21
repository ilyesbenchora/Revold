/**
 * Minimal GoCardless client (validation only for now).
 * Auth: Bearer access token + en-tête de version d'API obligatoire.
 * Doc: https://developer.gocardless.com/api-reference
 */

const REQUEST_TIMEOUT_MS = 15_000;
const GC_VERSION = "2015-07-06";

/** Base API selon l'environnement (live par défaut, sandbox pour les tests). */
function gocardlessBase(environment?: string): string {
  return environment?.trim().toLowerCase() === "sandbox"
    ? "https://api-sandbox.gocardless.com"
    : "https://api.gocardless.com";
}

export type GoCardlessCustomer = {
  id: string;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  company_name?: string | null;
  phone_number?: string | null;
  [key: string]: unknown;
};

export type GoCardlessMandate = {
  id: string;
  links?: { customer?: string | null } | null;
};

export type GoCardlessPayment = {
  id: string;
  amount?: number | null;      // cents
  currency?: string | null;
  status?: string | null;      // pending_submission, submitted, confirmed, paid_out, failed, cancelled, charged_back
  charge_date?: string | null; // YYYY-MM-DD
  created_at?: string | null;
  links?: { mandate?: string | null } | null;
  [key: string]: unknown;
};

/** Liste paginée par curseur : { <resource>: [...], meta: { cursors: { after } } }. */
async function gcList<T extends { id: string }>(
  accessToken: string,
  resource: string,
  environment?: string,
  max = 2000,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  while (all.length < max) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const res = await fetch(`${gocardlessBase(environment)}/${resource}?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "GoCardless-Version": GC_VERSION,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`GoCardless ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as Record<string, unknown> & { meta?: { cursors?: { after?: string | null } } };
    const data = (body[resource] as T[] | undefined) ?? [];
    if (data.length === 0) break;
    all.push(...data);
    after = body.meta?.cursors?.after ?? null;
    if (!after) break;
  }
  return all;
}

export const listGoCardlessCustomers = (token: string, environment?: string, max = 1000) =>
  gcList<GoCardlessCustomer>(token, "customers", environment, max);

export const listGoCardlessMandates = (token: string, environment?: string, max = 2000) =>
  gcList<GoCardlessMandate>(token, "mandates", environment, max);

export const listGoCardlessPayments = (token: string, environment?: string, max = 2000) =>
  gcList<GoCardlessPayment>(token, "payments", environment, max);

/** Valide l'access token via un appel authentifié minimal (/creditors). */
export async function pingGoCardless(accessToken: string, environment?: string): Promise<boolean> {
  if (!accessToken?.trim()) return false;
  try {
    const res = await fetch(`${gocardlessBase(environment)}/creditors?limit=1`, {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "GoCardless-Version": GC_VERSION,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
