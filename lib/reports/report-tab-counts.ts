/**
 * Shared tab counts for the 3 rapport sub-pages.
 * Loads all counts in parallel so each page shows correct numbers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";

export type TabCounts = {
  myCount: number;
  singleCount: number;
  multiCount: number;
};

export async function getTabCounts(
  supabase: SupabaseClient,
  orgId: string,
): Promise<TabCounts> {
  // Count activated reports (fast — just a count query)
  const myCountPromise = supabase
    .from("activated_reports")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .then(({ count }) => count ?? 0);

  // Count single + multi from HubSpot detection
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  let singleCount = 0;
  let multiCount = 0;

  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      singleCount = getReportSuggestions(integrations).length;
      multiCount = getCrossSourceReports(integrations).length;
    } catch {}
  }

  const myCount = await myCountPromise;

  return { myCount, singleCount, multiCount };
}
