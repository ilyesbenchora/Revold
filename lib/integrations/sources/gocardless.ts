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
