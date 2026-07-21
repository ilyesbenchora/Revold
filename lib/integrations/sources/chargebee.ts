/**
 * Minimal Chargebee client (validation only for now).
 * Auth: HTTP Basic — API key as username, empty password.
 * Doc: https://apidocs.chargebee.com/docs/api
 */

const REQUEST_TIMEOUT_MS = 15_000;

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
