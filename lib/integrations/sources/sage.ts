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
