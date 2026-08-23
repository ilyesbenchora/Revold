/**
 * Minimal Aircall API v1 client.
 * Auth: Basic (api_id:api_token) — créés depuis Aircall Dashboard →
 * Integrations & API → API Keys.
 * Docs : https://developer.aircall.io/api-references/
 */

const AIRCALL_API = "https://api.aircall.io/v1";

function authHeader(apiId: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${apiId}:${apiToken}`).toString("base64")}`;
}

export type AircallUser = {
  id: number;
  name: string;
  email?: string | null;
};

export type AircallCall = {
  id: number;
  direction: "inbound" | "outbound";
  /** initial | answered | done */
  status: string;
  missed_call_reason?: string | null;
  /** Unix seconds. */
  started_at: number;
  answered_at?: number | null;
  ended_at?: number | null;
  /** Secondes. */
  duration?: number | null;
  /** Numéro externe brut (appelant ou appelé). */
  raw_digits?: string | null;
  user?: { id: number; name?: string | null; email?: string | null } | null;
  contact?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    phone_numbers?: Array<{ value?: string | null }>;
    emails?: Array<{ value?: string | null }>;
  } | null;
};

/** Vérifie les identifiants API (GET /v1/ping → 200). */
export async function pingAircall(apiId: string, apiToken: string): Promise<boolean> {
  if (!apiId || !apiToken) return false;
  const res = await fetch(`${AIRCALL_API}/ping`, {
    headers: { Authorization: authHeader(apiId, apiToken) },
  });
  return res.ok;
}

/** Pagination générique Aircall (meta.next_page_link = URL complète). */
async function listPaginated<T>(
  firstUrl: string,
  key: string,
  apiId: string,
  apiToken: string,
  maxPages = 40,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; page < maxPages && url; page++) {
    const res = await fetch(url, { headers: { Authorization: authHeader(apiId, apiToken) } });
    if (!res.ok) throw new Error(`Aircall ${key} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as Record<string, unknown> & {
      meta?: { next_page_link?: string | null };
    };
    out.push(...((json[key] as T[] | undefined) ?? []));
    url = json.meta?.next_page_link ?? null;
  }
  return out;
}

export async function listAircallUsers(apiId: string, apiToken: string): Promise<AircallUser[]> {
  return listPaginated<AircallUser>(`${AIRCALL_API}/users?per_page=50`, "users", apiId, apiToken, 10);
}

/**
 * Appels des `sinceDays` derniers jours (défaut 90), du plus récent au plus
 * ancien. Plafonné en pages pour borner la 1re sync des gros comptes.
 */
export async function listAircallCalls(
  apiId: string,
  apiToken: string,
  sinceDays = 90,
): Promise<AircallCall[]> {
  const from = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  return listPaginated<AircallCall>(
    `${AIRCALL_API}/calls?per_page=50&order=desc&from=${from}`,
    "calls",
    apiId,
    apiToken,
  );
}
