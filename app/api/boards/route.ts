import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BOARD_TEMPLATES, seedBoardFromTemplate, seedBoardComposition } from "@/lib/boards/board-templates";
import { sanitizeComposition, listKnownExtraFields } from "@/lib/boards/board-suggest";
import { BOARD_VISIBILITIES, getBoardViewer, listVisibleBoards, type BoardVisibility } from "@/lib/boards/visibility";

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

  // Filtrés par visibilité (private / team / workspace) pour le lecteur courant.
  const viewer = await getBoardViewer(supabase);
  const boards = await listVisibleBoards(supabase, orgId, viewer);
  return NextResponse.json({ boards });
}

/** Crée un tableau de bord personnalisé. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { name?: string; template?: string | null; composition?: unknown; parentId?: string | null; visibility?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
  const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  // Visibilité : private (moi) | team (mon équipe) | workspace (défaut, toute l'org).
  const visibility: BoardVisibility = BOARD_VISIBILITIES.has(body.visibility as BoardVisibility)
    ? (body.visibility as BoardVisibility)
    : "workspace";
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

  // Équipe associée quand visibility='team' : l'espace de travail du créateur.
  const viewer = await getBoardViewer(supabase);
  const baseRow = { organization_id: orgId, name, created_by: user.id, ...(parentId ? { parent_id: parentId } : {}) };
  let { data, error } = await supabase
    .from("custom_dashboards")
    .insert({ ...baseRow, visibility, team: visibility === "team" ? viewer.team : null })
    .select("id, name")
    .single();
  // Migration visibility non appliquée → création sans (comportement workspace).
  if (error && /visibility|team/.test(error.message)) {
    ({ data, error } = await supabase.from("custom_dashboards").insert(baseRow).select("id, name").single());
  }
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
