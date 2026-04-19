/**
 * Retrieve the HubSpot access token for the current org.
 *
 * STRICTEMENT par org : on ne fait PLUS de fallback sur process.env.HUBSPOT_
 * ACCESS_TOKEN car c'est une faille multi-tenant qui faisait que les
 * nouvelles orgs (sans OAuth) voyaient les données du portail Vercel
 * (NovaTech demo).
 *
 * Si l'org n'a pas connecté son propre HubSpot via OAuth -> retourne null.
 * Les pages qui en dépendent doivent gérer ce cas (afficher un état vide
 * "Connectez HubSpot pour voir vos données").
 *
 * Le fallback env var reste accessible UNIQUEMENT pour les jobs cron
 * multi-tenant qui ont besoin du portail demo (ils doivent appeler
 * process.env.HUBSPOT_ACCESS_TOKEN explicitement, pas via ce helper).
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
  } catch (err) {
    console.error("[getHubSpotToken] DB query failed", { orgId, err });
  }

  // ⚠ PAS de fallback sur process.env.HUBSPOT_ACCESS_TOKEN — faille
  // multi-tenant. Si org sans OAuth, on retourne null et la page doit
  // afficher un état "non connecté".
  return null;
}
