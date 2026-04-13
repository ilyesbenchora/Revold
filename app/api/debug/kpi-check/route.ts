/**
 * GET /api/debug/kpi-check
 *
 * Diagnostic endpoint: tests the full KPI pipeline and reports what works/fails.
 * Returns: token status, API call results per object type, metric counts.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "No orgId" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  if (!token) {
    return NextResponse.json({
      status: "NO_TOKEN",
      orgId,
      hint: "getHubSpotToken returned null. Check integrations table and HUBSPOT_ACCESS_TOKEN env var.",
    });
  }

  // Test raw HubSpot API
  const tests: Record<string, string> = {};
  for (const objectType of ["contacts", "deals", "calls", "meetings", "emails", "tickets", "companies"]) {
    try {
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        tests[objectType] = `OK (${data.total ?? data.results?.length ?? 0} total)`;
      } else {
        tests[objectType] = `FAIL ${res.status}: ${(await res.text()).slice(0, 100)}`;
      }
    } catch (e) {
      tests[objectType] = `ERROR: ${String(e).slice(0, 100)}`;
    }
  }

  // Test full pipeline
  let kpiResult: { keys: number; nonNull: number; sampleKeys: string[] } | string;
  try {
    const kpiData = await fetchAllKpiData(token, supabase, orgId);
    const values = computeMetricValues(kpiData);
    const nonNull = Object.values(values).filter((v) => v !== null).length;
    kpiResult = {
      keys: Object.keys(values).length,
      nonNull,
      sampleKeys: Object.entries(values).filter(([, v]) => v !== null).slice(0, 5).map(([k, v]) => `${k} = ${v}`),
    };
  } catch (e) {
    kpiResult = `ERROR: ${String(e).slice(0, 200)}`;
  }

  // Check activated reports
  const { data: reports } = await supabase
    .from("activated_reports")
    .select("report_id, title, metrics")
    .eq("organization_id", orgId);

  return NextResponse.json({
    status: "OK",
    orgId,
    tokenPrefix: token.slice(0, 15) + "...",
    hubspotApiTests: tests,
    kpiPipeline: kpiResult,
    activatedReports: (reports ?? []).map((r) => ({
      id: r.report_id,
      title: r.title,
      metricsCount: ((r.metrics as string[]) ?? []).length,
    })),
  });
}
