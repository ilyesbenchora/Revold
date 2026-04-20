/**
 * POST /api/recommendations/activate
 *
 * Active une recommandation d'audit en coaching IA persisté dans
 * report_coachings (report_id = null car pas de rapport parent).
 * Le coaching apparaît ensuite dans la page /dashboard/insights-ia/<cat>
 * correspondant à la coachingCategory.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = ["commercial", "marketing", "data", "integration", "cross-source", "data-model"];

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const {
    recoId,
    title,
    painPoint,
    currentState,
    impact,
    actionPlan,
    severity,
    coachingCategory,
  } = body as Record<string, string | undefined>;

  if (!recoId || !title?.trim() || !painPoint?.trim() || !coachingCategory) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const category = VALID_CATEGORIES.includes(coachingCategory) ? coachingCategory : "commercial";
  const finalSeverity = ["critical", "warning", "info"].includes(severity ?? "") ? severity : "info";

  const fullBody = [
    painPoint?.trim(),
    currentState ? `\n📊 État actuel : ${currentState}` : "",
    impact ? `\n⚠ Impact : ${impact}` : "",
  ].filter(Boolean).join("");

  const supabase = await createSupabaseServerClient();

  // Idempotence : si déjà activée, retourne l'existante
  const { data: existing } = await supabase
    .from("report_coachings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("category", category)
    .like("title", `${title}%`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, id: existing.id, reused: true });
  }

  const { data: inserted, error } = await supabase
    .from("report_coachings")
    .insert({
      organization_id: orgId,
      report_id: null, // pas de rapport parent pour les recos audit
      category,
      team: null,
      kpi_label: `Recommandation audit : ${recoId}`,
      title: title.trim(),
      body: fullBody,
      recommendation: actionPlan?.trim() || null,
      severity: finalSeverity,
      status: "active",
      source_report_title: "Recommandation Audit Revold",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[recommendations/activate] insert failed", { orgId, err: error });
    return NextResponse.json({ error: error?.message ?? "Erreur insertion" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: inserted.id });
}
