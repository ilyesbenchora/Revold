import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  PAGE_NAVS,
  isNavItemVisible,
  slugifyNavLabel,
  type PageNavItem,
  type PageNavScope,
} from "@/lib/settings/page-nav";

export const dynamic = "force-dynamic";

const SCOPES = new Set<PageNavScope>(["me", "team", "all"]);

/** Rôle + pôle du membre courant (filtre de visibilité des pages custom). */
async function loadViewer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<{ userId: string; role: string | null; pole: string | null }> {
  try {
    const { data } = await supabase.from("profiles").select("role, pole").eq("id", userId).maybeSingle();
    return { userId, role: (data?.role as string | null) ?? null, pole: (data?.pole as string | null) ?? null };
  } catch {
    return { userId, role: null, pole: null };
  }
}

/** Items enregistrés d'une navigation ([] si table absente ou aucune ligne). */
async function loadItems(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  navKey: string,
): Promise<PageNavItem[]> {
  try {
    const { data } = await supabase
      .from("page_nav")
      .select("items")
      .eq("organization_id", orgId)
      .eq("nav_key", navKey)
      .maybeSingle();
    return Array.isArray(data?.items) ? (data.items as PageNavItem[]) : [];
  } catch {
    return [];
  }
}

/** Nettoie la liste d'items soumise : onglets standard (renommage) + pages custom. */
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
      const scope = typeof o.scope === "string" && SCOPES.has(o.scope as PageNavScope) ? (o.scope as PageNavScope) : "all";
      out.push({ slug, label, custom: true, scope });
    } else {
      const slug = typeof o.slug === "string" ? o.slug : "";
      if (!def.defaults.some((d) => d.slug === slug) || seen.has(`s:${slug}`)) continue;
      seen.add(`s:${slug}`);
      out.push({ slug, label });
    }
  }
  return out;
}

/** GET /api/page-nav?nav_key=ventes — items VISIBLES pour le membre courant. */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const navKey = new URL(request.url).searchParams.get("nav_key") ?? "";
  const def = PAGE_NAVS[navKey];
  if (!def) return NextResponse.json({ error: "nav_key inconnu" }, { status: 400 });

  const [items, viewer] = await Promise.all([loadItems(supabase, orgId, navKey), loadViewer(supabase, user.id)]);
  return NextResponse.json({ items: items.filter((i) => isNavItemVisible(def, i, viewer)) });
}

/**
 * POST /api/page-nav — enregistre (upsert) les onglets d'une navigation.
 * Le client ne voit que les items visibles pour LUI : les pages custom
 * invisibles (privées d'autres membres, autres équipes) sont PRÉSERVÉES
 * côté serveur — l'enregistrement ne remplace que le périmètre visible.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { nav_key?: string; items?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const navKey = typeof body.nav_key === "string" ? body.nav_key : "";
  const def = PAGE_NAVS[navKey];
  const submitted = cleanItems(navKey, body.items);
  if (!def || !submitted) return NextResponse.json({ error: "nav_key et items requis" }, { status: 400 });

  const { data: existingRow, error: readErr } = await supabase
    .from("page_nav")
    .select("id, items")
    .eq("organization_id", orgId)
    .eq("nav_key", navKey)
    .maybeSingle();
  if (readErr && /page_nav/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260819000001_page_nav non appliquée (table absente) — redéploie puis réessaie." },
      { status: 500 },
    );
  }
  const existing: PageNavItem[] = Array.isArray(existingRow?.items) ? (existingRow.items as PageNavItem[]) : [];
  const viewer = await loadViewer(supabase, user.id);

  // created_by : conservé pour un slug déjà existant, posé au créateur pour
  // une nouvelle page (le scope "me" filtre dessus).
  const byExistingSlug = new Map(existing.filter((i) => i.custom).map((i) => [i.slug, i]));
  const merged: PageNavItem[] = submitted.map((i) => {
    if (!i.custom) return i;
    const prev = byExistingSlug.get(i.slug);
    return { ...i, created_by: prev?.created_by ?? user.id };
  });
  // Pages custom hors du périmètre visible du membre : préservées telles quelles.
  for (const prev of existing) {
    if (prev.custom && !isNavItemVisible(def, prev, viewer) && !merged.some((i) => i.custom && i.slug === prev.slug)) {
      merged.push(prev);
    }
  }

  const row = { items: merged, updated_by: user.id, updated_at: new Date().toISOString() };
  const { error } = existingRow
    ? await supabase.from("page_nav").update(row).eq("id", existingRow.id)
    : await supabase.from("page_nav").insert({ organization_id: orgId, nav_key: navKey, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // On renvoie le périmètre visible (même filtre que le GET).
  return NextResponse.json({ ok: true, items: merged.filter((i) => isNavItemVisible(def, i, viewer)) });
}
