import type { SupabaseClient } from "@supabase/supabase-js";
import { getOAuthProvider } from "./oauth-providers";

/**
 * Renvoie un access_token valide pour un provider OAuth connecté, en le
 * rafraîchissant si nécessaire (Google/LinkedIn). Met à jour la table
 * `integrations` avec le nouveau token. Renvoie null si non connecté.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, token_expires_at, metadata")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  if (!row?.access_token) return null;

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at as string).getTime() : null;
  const stillValid = !expiresAt || expiresAt - Date.now() > 60_000; // marge 1 min
  if (stillValid || !row.refresh_token) return row.access_token as string;

  // Rafraîchissement.
  const p = getOAuthProvider(provider);
  if (!p) return row.access_token as string;
  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) return row.access_token as string;

  try {
    const res = await fetch(p.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token as string,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return row.access_token as string;
    const tokens = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
    if (!tokens.access_token) return row.access_token as string;

    const newExpiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    await supabase
      .from("integrations")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? (row.refresh_token as string),
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("provider", provider);
    return tokens.access_token;
  } catch {
    return row.access_token as string;
  }
}
