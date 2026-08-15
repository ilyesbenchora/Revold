import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { savedReportToClient, type SavedReportRow } from "@/lib/agents/saved-reports-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Met à jour un rapport (masquage, rattachement d'alerte…). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { hidden?: boolean; alertId?: string | null; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof body.hidden === "boolean") patch.hidden = body.hidden;
  if ("alertId" in body) patch.alert_id = body.alertId && UUID_RE.test(body.alertId) ? body.alertId : null;
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 300);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("saved_reports")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
  return NextResponse.json({ report: savedReportToClient(data as SavedReportRow) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase
    .from("saved_reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
