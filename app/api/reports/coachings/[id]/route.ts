/**
 * PATCH /api/reports/coachings/[id]
 * Body: { status: "active" | "done" | "removed" }
 *
 * Met à jour le statut d'un coaching manuel (report_coachings). Sert au
 * bouton "Retirer" / "Restaurer" / "Marqué fait" dans la sous-page Mes
 * coachings IA des pages /dashboard/insights-ia/<category>.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID = new Set(["active", "done", "removed"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !VALID.has(status)) {
    return NextResponse.json({ error: "status invalide (active|done|removed)" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("report_coachings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[coachings PATCH]", { id, status, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
