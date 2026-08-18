import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const UNITS = new Set(["percent", "currency", "count"]);

/**
 * Modifie une tuile KPI ajoutée (Personnaliser les KPIs → ✎) : titre, câblage
 * (agg_spec) et unité. Un recâblage invalide la référence d'évolution
 * (prev_value) — elle repart de la prochaine résolution.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { id } = await params;
  let body: { title?: string; agg_spec?: Record<string, unknown> | null; unit_mode?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (body.agg_spec && typeof body.agg_spec === "object") {
    const spec = body.agg_spec;
    if (typeof spec.entity !== "string" || typeof spec.groupBy !== "string") {
      return NextResponse.json({ error: "agg_spec invalide (entity/groupBy requis)" }, { status: 400 });
    }
    update.agg_spec = spec;
    // Câblage modifié → la référence d'évolution de la veille ne vaut plus.
    update.prev_value = null;
    update.prev_value_at = null;
  }
  if (typeof body.unit_mode === "string" && UNITS.has(body.unit_mode)) update.unit_mode = body.unit_mode;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  }

  const doUpdate = (u: Record<string, unknown>) =>
    supabase
      .from("page_tiles")
      .update(u)
      .eq("organization_id", orgId)
      .eq("id", id)
      .eq("kind", "kpi")
      .select("id, title, agg_spec, unit_mode")
      .maybeSingle();
  let { data, error } = await doUpdate(update);
  // Colonnes prev_value absentes (migration non appliquée) → retente sans elles.
  if (error && /prev_value/.test(error.message)) {
    const rest = { ...update };
    delete rest.prev_value;
    delete rest.prev_value_at;
    ({ data, error } = await doUpdate(rest));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tuile introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, tile: data });
}

/** Supprime une personnalisation : retire une tuile ajoutée, ou restaure une tuile/un bloc masqué. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { id } = await params;
  const { error } = await supabase
    .from("page_tiles")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
