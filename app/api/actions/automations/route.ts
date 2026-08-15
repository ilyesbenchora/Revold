import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AUTOMATABLE_KEYS } from "@/lib/actions/engine";

export const dynamic = "force-dynamic";

/**
 * Automatisation opt-in d'une famille d'actions (boîte Actions) :
 * POST { key, enabled } — l'utilisateur décide qu'une famille s'exécute
 * désormais toute seule (ou revient au manuel). Stocké par org dans
 * entity_resolution_config (rule_id auto_action_<clé>). Les fusions de
 * doublons ne sont jamais automatisables (irréversibles).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { key?: string; enabled?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const key = typeof body.key === "string" ? body.key : "";
  if (!(AUTOMATABLE_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json({ error: "Cette famille d'actions n'est pas automatisable." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (booléen) requis" }, { status: 400 });
  }

  const { error } = await supabase
    .from("entity_resolution_config")
    .upsert(
      { organization_id: orgId, rule_id: `auto_action_${key}`, enabled: body.enabled, config: {}, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,rule_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key, enabled: body.enabled });
}
