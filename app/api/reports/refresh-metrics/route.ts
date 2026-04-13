/**
 * POST /api/reports/refresh-metrics
 *
 * Updates metrics[], description, and expected_value of all activated
 * reports to match the current report-suggestions templates.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { detectIntegrations } from "@/lib/integrations/detect-integrations";

type TemplateData = { metrics: string[]; description: string; expectedValue: string };

export async function POST() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  const templateMap = new Map<string, TemplateData>();

  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      for (const r of getReportSuggestions(integrations)) {
        templateMap.set(r.id, { metrics: r.metrics, description: r.description, expectedValue: r.expectedValue });
      }
      for (const r of getCrossSourceReports(integrations)) {
        templateMap.set(r.id, { metrics: r.metrics, description: r.description, expectedValue: r.expectedValue });
      }
    } catch {}
  }

  const { data: activated } = await supabase
    .from("activated_reports")
    .select("id, report_id, metrics, description, expected_value")
    .eq("organization_id", orgId);

  let updated = 0;
  for (const report of activated ?? []) {
    const tpl = templateMap.get(report.report_id);
    if (!tpl) continue;

    const oldMetrics = JSON.stringify((report.metrics as string[]) ?? []);
    const oldDesc = report.description ?? "";
    const oldExpected = report.expected_value ?? "";
    const needsUpdate =
      oldMetrics !== JSON.stringify(tpl.metrics) ||
      oldDesc !== tpl.description ||
      oldExpected !== tpl.expectedValue;

    if (!needsUpdate) continue;

    await supabase
      .from("activated_reports")
      .update({
        metrics: tpl.metrics,
        description: tpl.description,
        expected_value: tpl.expectedValue,
      })
      .eq("id", report.id);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
