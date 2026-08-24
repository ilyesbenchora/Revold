import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Sections de page (en-têtes nommés ajoutés par l'utilisateur, façon Notion).
 * GET  ?page_key=…  → liste ordonnée par anchor.
 * POST { page_key, title?, anchor? } → crée une section.
 */

const cleanTitle = (v: unknown): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return (s || "Nouvelle section").slice(0, 120);
};
const cleanAnchor = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 9999) : 0;
};

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const pageKey = new URL(request.url).searchParams.get("page_key");
  if (!pageKey) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

  // section_key peut ne pas être migré : repli sur les colonnes de base.
  let cols = "id, page_key, title, anchor, section_key, created_at";
  for (let i = 0; i < 2; i++) {
    const { data, error } = await supabase
      .from("page_sections")
      .select(cols)
      .eq("organization_id", orgId)
      .eq("page_key", pageKey)
      .order("anchor", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error) return NextResponse.json({ sections: data ?? [] });
    if (/section_key/.test(error.message)) { cols = "id, page_key, title, anchor, created_at"; continue; }
    // Table absente (migration non appliquée) → liste vide, jamais bloquant.
    return NextResponse.json({ sections: [], needsMigration: true });
  }
  return NextResponse.json({ sections: [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_key?: string; title?: unknown; anchor?: unknown; section_key?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.page_key) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

  // section_key non nul = OVERRIDE de titre d'une section existante (upsert).
  const sectionKey = typeof body.section_key === "string" && body.section_key.trim() ? body.section_key.trim().slice(0, 160) : null;
  if (sectionKey) {
    const { data, error } = await supabase
      .from("page_sections")
      .upsert(
        { organization_id: orgId, page_key: body.page_key, section_key: sectionKey, title: cleanTitle(body.title), anchor: 0, created_by: user.id },
        { onConflict: "organization_id,page_key,section_key" },
      )
      .select("id, page_key, title, anchor, section_key, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ section: data });
  }

  const { data, error } = await supabase
    .from("page_sections")
    .insert({
      organization_id: orgId,
      page_key: body.page_key,
      title: cleanTitle(body.title),
      anchor: cleanAnchor(body.anchor),
      created_by: user.id,
    })
    .select("id, page_key, title, anchor, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ section: data });
}
