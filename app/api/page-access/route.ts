import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getCurrentRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

const TEAMS = new Set(["sales", "marketing", "cs", "finance"]);
const RIGHTS = new Set(["view", "edit", "create"]);

/** Nettoie un objet access : équipes/droits connus, valeurs booléennes. */
function cleanAccess(v: unknown): Record<string, Record<string, boolean>> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, Record<string, boolean>> = {};
  for (const [team, rights] of Object.entries(v as Record<string, unknown>)) {
    if (!TEAMS.has(team) || !rights || typeof rights !== "object" || Array.isArray(rights)) continue;
    const r: Record<string, boolean> = {};
    for (const [right, val] of Object.entries(rights as Record<string, unknown>)) {
      if (RIGHTS.has(right) && typeof val === "boolean") r[right] = val;
    }
    out[team] = r;
  }
  return out;
}

/** Liste les règles d'accès par page de l'organisation. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("page_access")
    .select("page_href, access")
    .eq("organization_id", orgId);
  if (error) {
    // Table absente (migration non appliquée) → aucune règle, pas une erreur bloquante.
    if (/page_access/.test(error.message)) return NextResponse.json({ rules: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
}

/** Enregistre (upsert) la règle d'accès d'une page. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_href?: string; access?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const href = typeof body.page_href === "string" ? body.page_href.trim() : "";
  const access = cleanAccess(body.access);
  if (!href.startsWith("/dashboard") || !access) {
    return NextResponse.json({ error: "page_href et access requis" }, { status: 400 });
  }

  // Bloc « Paramètres » de la matrice : réservé aux ADMINS — eux seuls règlent
  // qui accède aux pages de Paramètres.
  if (href.startsWith("/dashboard/parametres")) {
    const role = await getCurrentRole(supabase, user.id);
    if (role !== "admin") {
      return NextResponse.json({ error: "Réservé aux admins : seuls eux règlent l'accès aux pages Paramètres." }, { status: 403 });
    }
  }

  // Upsert manuel (une règle par page et par org).
  const { data: existing, error: readErr } = await supabase
    .from("page_access")
    .select("id")
    .eq("organization_id", orgId)
    .eq("page_href", href)
    .maybeSingle();
  if (readErr && /page_access/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260814000002_page_access non appliquée (table page_access absente)." },
      { status: 500 },
    );
  }
  const { error } = existing
    ? await supabase
        .from("page_access")
        .update({ access, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase
        .from("page_access")
        .insert({ organization_id: orgId, page_href: href, access, updated_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
