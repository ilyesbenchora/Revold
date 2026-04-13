/**
 * Shared tab counts for the 3 rapport sub-pages.
 * Excludes already-activated reports from single/multi counts.
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
  // Fetch activated report IDs + count in one query
  const { data: activatedData } = await supabase
    .from("activated_reports")
    .select("report_id")
    .eq("organization_id", orgId);

  const activatedReports = activatedData ?? [];
  const myCount = activatedReports.length;
  const activatedIds = new Set(activatedReports.map((r) => r.report_id));

  // Count single + multi from HubSpot detection, excluding activated
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  let singleCount = 0;
  let multiCount = 0;

  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      const allSingle = getReportSuggestions(integrations);
      const allMulti = getCrossSourceReports(integrations);
      singleCount = allSingle.filter((r) => !activatedIds.has(r.id)).length;
      multiCount = allMulti.filter((r) => !activatedIds.has(r.id)).length;
    } catch {}
  }

  return { myCount, singleCount, multiCount };
}
