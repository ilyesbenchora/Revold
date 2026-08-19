import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Partage public d'un tableau de bord (lecture seule) :
 *  - GET    ?pageKey=…       → { share: { id, url } | null }
 *  - POST   { pageKey, title } → crée (ou renvoie) le lien → { share }
 *  - DELETE { pageKey }      → révoque le lien (l'URL meurt immédiatement)
 * L'id du partage est le jeton du lien /partage/<id> — recréer après une
 * révocation génère un NOUVEAU jeton.
 */

const PAGE_KEY_RE = /^(tableau_bord|board_[0-9a-f-]{36})$/i;

function shareUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/partage/${id}`;
}

async function authed() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) } as const;
  return { supabase, user, orgId } as const;
}

export async function GET(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const pageKey = new URL(request.url).searchParams.get("pageKey") ?? "";
  if (!PAGE_KEY_RE.test(pageKey)) return NextResponse.json({ error: "pageKey invalide" }, { status: 400 });
  try {
    const { data } = await a.supabase
      .from("board_shares")
      .select("id")
      .eq("organization_id", a.orgId)
      .eq("page_key", pageKey)
      .maybeSingle();
    return NextResponse.json({ share: data ? { id: data.id, url: shareUrl(data.id as string) } : null });
  } catch {
    return NextResponse.json({ share: null, unavailable: true });
  }
}

export async function POST(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { pageKey?: string; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const pageKey = typeof body.pageKey === "string" && PAGE_KEY_RE.test(body.pageKey) ? body.pageKey : null;
  if (!pageKey) return NextResponse.json({ error: "pageKey invalide" }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";

  // Lien existant → on le renvoie tel quel (un seul jeton actif par page).
  const { data: existing, error: readErr } = await a.supabase
    .from("board_shares")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("page_key", pageKey)
    .maybeSingle();
  if (readErr && /board_shares/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260819000003_board_shares non appliquée (partage indisponible)." },
      { status: 500 },
    );
  }
  if (existing) return NextResponse.json({ share: { id: existing.id, url: shareUrl(existing.id as string) } });

  const { data, error } = await a.supabase
    .from("board_shares")
    .insert({ organization_id: a.orgId, page_key: pageKey, title: title || null, created_by: a.user.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share: { id: data.id, url: shareUrl(data.id as string) } });
}

export async function DELETE(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { pageKey?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const pageKey = typeof body.pageKey === "string" && PAGE_KEY_RE.test(body.pageKey) ? body.pageKey : null;
  if (!pageKey) return NextResponse.json({ error: "pageKey invalide" }, { status: 400 });
  const { error } = await a.supabase
    .from("board_shares")
    .delete()
    .eq("organization_id", a.orgId)
    .eq("page_key", pageKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
