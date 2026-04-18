/**
 * POST /api/reports/activate-coaching
 *
 * Persists a "Coaching IA à faire" item derived from an activated report,
 * routed to the correct coaching page based on the report's team.
 *
 * Body : { reportId, kpiLabel, title, body, recommendation?, severity? }
 *
 * The team -> category mapping (commercial / marketing / data / integration
 * / cross-source / data-model) is resolved server-side from the activated
 * report so the client cannot fake the routing.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TEAM_TO_CATEGORY: Record<string, string> = {
  sales: "commercial",
  marketing: "marketing",
  cs: "commercial",       // CS reports → commercial coaching (relation client)
  revops: "data-model",   // RevOps → data-model coaching (ops/data quality)
};

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { reportId, kpiLabel, title, body: text, recommendation, severity } = body as {
    reportId?: string;
    kpiLabel?: string;
    title?: string;
    body?: string;
    recommendation?: string;
    severity?: string;
  };

  if (!reportId || !title?.trim() || !text?.trim()) {
    return NextResponse.json(
      { error: "reportId, title et body sont requis." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // Resolve team + display_category + title server-side from the report
  const { data: report, error: reportErr } = await supabase
    .from("activated_reports")
    .select("id, team, display_category, title, organization_id")
    .eq("id", reportId)
    .eq("organization_id", orgId)
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });
  }

  const team = (report.team as string | null) ?? "sales";
  const category = TEAM_TO_CATEGORY[team] ?? "commercial";

  const { data: inserted, error } = await supabase
    .from("report_coachings")
    .insert({
      organization_id: orgId,
      report_id: report.id,
      category,
      team,
      kpi_label: kpiLabel ?? null,
      title: title.trim(),
      body: text.trim(),
      recommendation: recommendation?.trim() || null,
      severity: severity ?? "info",
      source_report_title: report.title,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[activate-coaching] insert failed", {
      orgId,
      reportId,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: `Erreur enregistrement : ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    category,
    redirectTo: `/dashboard/insights-ia/${category}`,
  });
}
