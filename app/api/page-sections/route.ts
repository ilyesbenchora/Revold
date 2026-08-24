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

  const { data, error } = await supabase
    .from("page_sections")
    .select("id, page_key, title, anchor, created_at")
    .eq("organization_id", orgId)
    .eq("page_key", pageKey)
    .order("anchor", { ascending: true })
    .order("created_at", { ascending: true });
  // Table absente (migration non appliquée) → liste vide, jamais bloquant.
  if (error) return NextResponse.json({ sections: [], needsMigration: true });
  return NextResponse.json({ sections: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_key?: string; title?: unknown; anchor?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.page_key) return NextResponse.json({ error: "page_key requis" }, { status: 400 });

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
