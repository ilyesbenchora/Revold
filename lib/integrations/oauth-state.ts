/**
 * OAuth state signé pour protection CSRF.
 *
 * On combine orgId + nonce aléatoire + HMAC-SHA256 pour produire un state
 * vérifiable au callback. La clé secrète est dérivée de SUPABASE_SERVICE_ROLE_KEY
 * (ou OAUTH_STATE_SECRET si défini explicitement).
 *
 * Format du state : `<orgId>.<nonce>.<hmac>` (base64url)
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET ou SUPABASE_SERVICE_ROLE_KEY requis pour signer le state OAuth");
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

/** Crée un state signé pour orgId. Le nonce est aléatoire à chaque appel. */
export function createOAuthState(orgId: string): string {
  const nonce = b64url(randomBytes(16));
  const payload = `${orgId}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/** Vérifie le state et retourne l'orgId si valide, null sinon. */
export function verifyOAuthState(state: string): { orgId: string; nonce: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [orgId, nonce, sig] = parts;
  const expected = sign(`${orgId}.${nonce}`);
  // Constant-time comparison
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { orgId, nonce };
}
