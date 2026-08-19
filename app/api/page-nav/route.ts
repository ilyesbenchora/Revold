import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PAGE_NAVS, slugifyNavLabel, type PageNavItem } from "@/lib/settings/page-nav";

export const dynamic = "force-dynamic";

/** Nettoie la liste d'items : onglets standard (renommage) + pages custom. */
function cleanItems(navKey: string, v: unknown): PageNavItem[] | null {
  const def = PAGE_NAVS[navKey];
  if (!def || !Array.isArray(v)) return null;
  const out: PageNavItem[] = [];
  const seen = new Set<string>();
  for (const m of v.slice(0, 15)) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 60) : "";
    if (!label) continue;
    if (o.custom === true) {
      const slug = slugifyNavLabel(typeof o.slug === "string" && o.slug.trim() ? o.slug : label);
      // Un slug custom ne peut pas entrer en collision avec une sous-page standard.
      if (!slug || seen.has(`c:${slug}`) || def.defaults.some((d) => d.slug === slug)) continue;
      seen.add(`c:${slug}`);
      out.push({ slug, label, custom: true });
    } else {
      const slug = typeof o.slug === "string" ? o.slug : "";
      if (!def.defaults.some((d) => d.slug === slug) || seen.has(`s:${slug}`)) continue;
      seen.add(`s:${slug}`);
      out.push({ slug, label });
    }
  }
  return out;
}

/** GET /api/page-nav?nav_key=ventes — items enregistrés (bruts, [] si aucun). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const navKey = new URL(request.url).searchParams.get("nav_key") ?? "";
  if (!PAGE_NAVS[navKey]) return NextResponse.json({ error: "nav_key inconnu" }, { status: 400 });

  try {
    const { data } = await supabase
      .from("page_nav")
      .select("items")
      .eq("organization_id", orgId)
      .eq("nav_key", navKey)
      .maybeSingle();
    return NextResponse.json({ items: Array.isArray(data?.items) ? data.items : [] });
  } catch {
    // Table absente (migration au prochain build) → défauts côté client.
    return NextResponse.json({ items: [] });
  }
}

/** POST /api/page-nav — enregistre (upsert) les onglets d'une navigation. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { nav_key?: string; items?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const navKey = typeof body.nav_key === "string" ? body.nav_key : "";
  const items = cleanItems(navKey, body.items);
  if (!items) return NextResponse.json({ error: "nav_key et items requis" }, { status: 400 });

  const { data: existing, error: readErr } = await supabase
    .from("page_nav")
    .select("id")
    .eq("organization_id", orgId)
    .eq("nav_key", navKey)
    .maybeSingle();
  if (readErr && /page_nav/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260819000001_page_nav non appliquée (table absente) — redéploie puis réessaie." },
      { status: 500 },
    );
  }
  const row = { items, updated_by: user.id, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("page_nav").update(row).eq("id", existing.id)
    : await supabase.from("page_nav").insert({ organization_id: orgId, nav_key: navKey, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items });
}
