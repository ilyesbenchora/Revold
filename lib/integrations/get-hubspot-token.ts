/**
 * Retrieve the HubSpot access token for the current org.
 *
 * Resolution order:
 *  1. Supabase `integrations` table (OAuth flow or manually inserted)
 *     → auto-refreshes if token is about to expire
 *  2. Fallback: `process.env.HUBSPOT_ACCESS_TOKEN` (Vercel env / private app)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshHubSpotToken } from "./hubspot";

export async function getHubSpotToken(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  // ── 1. Try Supabase integrations table ──────────────────────────────────
  try {
    const { data } = await supabase
      .from("integrations")
      .select("access_token, refresh_token, token_expires_at")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot")
      .eq("is_active", true)
      .single();

    if (data?.access_token) {
      // Check expiry — refresh if <5 min remaining
      const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
      const needsRefresh = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;

      if (needsRefresh && data.refresh_token) {
        try {
          const tokens = await refreshHubSpotToken(data.refresh_token);

          await supabase
            .from("integrations")
            .update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId)
            .eq("provider", "hubspot");

          return tokens.access_token;
        } catch {
          // Refresh failed — use existing token
          return data.access_token;
        }
      }

      return data.access_token;
    }
  } catch {
    // Table may not exist or query failed — fall through to env var
  }

  // ── 2. Fallback: env var (private app / Vercel config) ──────────────────
  return process.env.HUBSPOT_ACCESS_TOKEN ?? null;
}
