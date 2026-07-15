import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "../oauth-token";
import { type AdMetrics } from "./ads-common";
import { fetchMetaAdsMetrics } from "./meta-ads";
import { fetchGoogleAnalyticsMetrics } from "./google-analytics";
import { fetchGoogleAdsMetrics } from "./google-ads";
import { fetchLinkedInAdsMetrics } from "./linkedin-ads";

const FETCHERS: Record<string, (token: string) => Promise<AdMetrics>> = {
  meta_ads: fetchMetaAdsMetrics,
  google_analytics: fetchGoogleAnalyticsMetrics,
  google_ads: fetchGoogleAdsMetrics,
  linkedin_ads: fetchLinkedInAdsMetrics,
};

const AD_PROVIDERS = Object.keys(FETCHERS);

/**
 * Récupère les métriques (30j) de toutes les régies publicité/web connectées
 * pour une organisation. Chaque provider est indépendant (erreur isolée).
 */
export async function fetchAdsPerformance(supabase: SupabaseClient, orgId: string): Promise<AdMetrics[]> {
  const { data } = await supabase
    .from("integrations")
    .select("provider")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .in("provider", AD_PROVIDERS);
  const connected = (data ?? []).map((r) => r.provider as string);
  if (connected.length === 0) return [];

  const results = await Promise.all(
    connected.map(async (provider) => {
      const token = await getValidAccessToken(supabase, orgId, provider);
      if (!token) return null;
      return FETCHERS[provider](token);
    }),
  );
  return results.filter((m): m is AdMetrics => m !== null);
}
