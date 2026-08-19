import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BOARD_TEMPLATES, seedBoardFromTemplate, seedBoardComposition } from "@/lib/boards/board-templates";
import { sanitizeComposition, listKnownExtraFields } from "@/lib/boards/board-suggest";

export const dynamic = "force-dynamic";

const MAX_BOARDS = 20;
/** Onglets (sous-pages) maximum par tableau. */
const MAX_TABS = 12;

/** Liste les tableaux de bord personnalisés de l'organisation (avec leurs onglets). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // parent_id d'une migration récente → repli sans la colonne.
  const full = await supabase
    .from("custom_dashboards")
    .select("id, name, parent_id, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  let data: unknown = full.data;
  let error = full.error;
  if (error && /parent_id/.test(error.message)) {
    const basic = await supabase
      .from("custom_dashboards")
      .select("id, name, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    data = basic.data;
    error = basic.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ boards: data ?? [] });
}

/** Crée un tableau de bord personnalisé. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { name?: string; template?: string | null; composition?: unknown; parentId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
  const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  // Template de départ (optionnel) — id inconnu = page vierge, jamais une erreur.
  const template =
    typeof body.template === "string" && BOARD_TEMPLATES.some((t) => t.id === body.template)
      ? body.template
      : null;
  // Composition proposée par l'agent (page Templates) — RE-sanitisée ici :
  // on ne fait jamais confiance au client pour des specs d'agrégats.
  const composition = body.composition
    ? sanitizeComposition(body.composition, await listKnownExtraFields(supabase, orgId)).composition
    : null;

  // ── Onglet (sous-page) : le parent doit être un TABLEAU RACINE de l'org —
  //    deux niveaux maximum (tableau → onglets), jamais d'onglet d'onglet. ──
  if (parentId) {
    const { data: parent, error: parentErr } = await supabase
      .from("custom_dashboards")
      .select("id, parent_id")
      .eq("organization_id", orgId)
      .eq("id", parentId)
      .maybeSingle();
    if (parentErr && /parent_id/.test(parentErr.message)) {
      return NextResponse.json(
        { error: "Migration 20260819000002_custom_dashboards_parent non appliquée (onglets indisponibles)." },
        { status: 500 },
      );
    }
    if (!parent) return NextResponse.json({ error: "Tableau parent introuvable." }, { status: 404 });
    if (parent.parent_id) {
      return NextResponse.json({ error: "Un onglet ne peut pas avoir de sous-onglets." }, { status: 400 });
    }
    const { count: tabCount } = await supabase
      .from("custom_dashboards")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("parent_id", parentId);
    if ((tabCount ?? 0) >= MAX_TABS) {
      return NextResponse.json({ error: `Maximum ${MAX_TABS} onglets par tableau — supprime-en un d'abord.` }, { status: 400 });
    }
  } else {
    // Plafond sur les TABLEAUX racines uniquement (les onglets ont le leur).
    const rootRes = await supabase
      .from("custom_dashboards")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("parent_id", null);
    let count = rootRes.count;
    if (rootRes.error && /parent_id/.test(rootRes.error.message)) {
      ({ count } = await supabase
        .from("custom_dashboards")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId));
    }
    if ((count ?? 0) >= MAX_BOARDS) {
      return NextResponse.json({ error: `Maximum ${MAX_BOARDS} tableaux de bord — supprime-en un d'abord.` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("custom_dashboards")
    .insert({ organization_id: orgId, name, created_by: user.id, ...(parentId ? { parent_id: parentId } : {}) })
    .select("id, name")
    .single();
  if (error) {
    const msg = /custom_dashboards/.test(error.message)
      ? "Migration 20260819000001_custom_dashboards non appliquée (table absente)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Composition de départ (tuiles + tables) — best effort, la page reste
  // utilisable vierge si le seed échoue. La composition agent prime sur le template.
  if (data?.id) {
    if (composition && (composition.tiles.length > 0 || composition.tables.length > 0)) {
      await seedBoardComposition(supabase, orgId, user.id, data.id as string, composition);
    } else if (template) {
      await seedBoardFromTemplate(supabase, orgId, user.id, data.id as string, template);
    }
  }

  return NextResponse.json({ board: data });
}
