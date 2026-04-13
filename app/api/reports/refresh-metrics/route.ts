/**
 * POST /api/reports/refresh-metrics
 *
 * Updates the metrics[] array of all activated reports to match
 * the current report-suggestions templates. This fixes reports
 * activated before a template change (orphaned null metrics).
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { detectIntegrations } from "@/lib/integrations/detect-integrations";

export async function POST() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // Build a map of reportId → current metrics from templates
  const metricsMap = new Map<string, string[]>();

  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      for (const r of getReportSuggestions(integrations)) metricsMap.set(r.id, r.metrics);
      for (const r of getCrossSourceReports(integrations)) metricsMap.set(r.id, r.metrics);
    } catch {}
  }

  // Fetch activated reports
  const { data: activated } = await supabase
    .from("activated_reports")
    .select("id, report_id, metrics")
    .eq("organization_id", orgId);

  let updated = 0;
  for (const report of activated ?? []) {
    const currentMetrics = metricsMap.get(report.report_id);
    if (!currentMetrics) continue;

    // Check if metrics differ
    const oldMetrics = (report.metrics as string[]) ?? [];
    const needsUpdate = JSON.stringify(oldMetrics) !== JSON.stringify(currentMetrics);
    if (!needsUpdate) continue;

    await supabase
      .from("activated_reports")
      .update({ metrics: currentMetrics })
      .eq("id", report.id);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
