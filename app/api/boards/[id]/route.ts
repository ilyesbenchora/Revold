import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BOARD_VISIBILITIES, getBoardViewer, type BoardVisibility } from "@/lib/boards/visibility";

export const dynamic = "force-dynamic";

/** Renomme un tableau de bord et/ou change sa visibilité (privé / équipe / espace). */
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
  let body: { name?: string; visibility?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const visibility = BOARD_VISIBILITIES.has(body.visibility as BoardVisibility)
    ? (body.visibility as BoardVisibility)
    : null;
  if (!name && !visibility) return NextResponse.json({ error: "name ou visibility requis" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (visibility) {
    update.visibility = visibility;
    // 'team' = l'équipe (espace de travail) de celui qui fait le choix.
    const viewer = await getBoardViewer(supabase);
    update.team = visibility === "team" ? viewer.team : null;
  }

  const { data, error } = await supabase
    .from("custom_dashboards")
    .update(update)
    .eq("organization_id", orgId)
    .eq("id", id)
    .select("id, name")
    .maybeSingle();
  if (error) {
    const msg = /visibility|team/.test(error.message)
      ? "Migration 20260819000011_board_visibility non appliquée (visibilité indisponible)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Tableau introuvable" }, { status: 404 });
  return NextResponse.json({ board: data });
}

/**
 * Supprime un tableau de bord + toute sa personnalisation (tuiles KPI, tables
 * de données, mapping d'outils sources) sous sa clé board_<id>.
 */
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
  const { data, error } = await supabase
    .from("custom_dashboards")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tableau introuvable" }, { status: 404 });

  // Nettoyage de la personnalisation orpheline — best effort (tables keyed par page_key).
  const pageKey = `board_${id}`;
  await Promise.all([
    supabase.from("page_tiles").delete().eq("organization_id", orgId).eq("page_key", pageKey),
    supabase.from("page_data_tables").delete().eq("organization_id", orgId).eq("page_key", pageKey),
    supabase.from("tool_mappings").delete().eq("organization_id", orgId).eq("page_key", pageKey),
  ]).catch(() => {});

  return NextResponse.json({ ok: true });
}
