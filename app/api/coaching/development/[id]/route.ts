import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const PLAN_STATUS = new Set(["active", "achieved", "paused", "dropped"]);
const STEP_STATUS = new Set(["todo", "doing", "done", "skipped"]);

/**
 * PATCH : avancement du plan ou d'une de ses étapes.
 *  - { status } → statut du plan
 *  - { step_id, status, evidence } → statut d'une étape (avec preuve libre)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let b: { status?: string; step_id?: string; evidence?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  // ── Étape du plan ──
  if (b.step_id) {
    if (!b.status || !STEP_STATUS.has(b.status)) return NextResponse.json({ error: "Statut d'étape invalide" }, { status: 400 });
    const { error } = await supabase
      .from("development_steps")
      .update({
        status: b.status,
        completed_at: b.status === "done" ? new Date().toISOString() : null,
        ...(typeof b.evidence === "string" ? { evidence: b.evidence.slice(0, 2000) } : {}),
      })
      .eq("id", b.step_id)
      .eq("plan_id", id)
      .eq("organization_id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Plan ──
  if (!b.status || !PLAN_STATUS.has(b.status)) return NextResponse.json({ error: "Statut de plan invalide" }, { status: 400 });
  const { error } = await supabase
    .from("development_plans")
    .update({ status: b.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase.from("development_plans").delete().eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
