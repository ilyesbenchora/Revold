import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AUTOMATABLE_KEYS } from "@/lib/actions/engine";

export const dynamic = "force-dynamic";

/**
 * Automatisation opt-in d'une famille d'actions (boîte Actions) — stockée
 * par org dans entity_resolution_config (rule_id auto_action_<clé>) :
 * - POST { key, enabled } : mode GLOBAL de la famille (les exceptions par
 *   entité sont conservées) ;
 * - POST { key, entityKey, list: "include" | "exclude", enabled } : exception
 *   PAR ENTITÉ — include = automatiser pour CE deal/entreprise/contact
 *   malgré un mode manuel ; exclude = garder CE compte en manuel malgré un
 *   mode auto (sécurité comptes clés).
 * Les fusions de doublons ne sont jamais automatisables (irréversibles).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { key?: string; enabled?: boolean; entityKey?: string; list?: "include" | "exclude" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const key = typeof body.key === "string" ? body.key : "";
  if (!(AUTOMATABLE_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json({ error: "Cette famille d'actions n'est pas automatisable." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (booléen) requis" }, { status: 400 });
  }

  // Ligne existante : le mode global ET les exceptions vivent dessus.
  const { data: row } = await supabase
    .from("entity_resolution_config")
    .select("enabled, config")
    .eq("organization_id", orgId)
    .eq("rule_id", `auto_action_${key}`)
    .maybeSingle();
  const cfg = { ...((row?.config ?? {}) as Record<string, unknown>) };
  const readList = (k: string) => (Array.isArray(cfg[k]) ? (cfg[k] as unknown[]).filter((x): x is string => typeof x === "string") : []);

  let globalEnabled = row?.enabled ?? false;
  if (typeof body.entityKey === "string" && body.entityKey && (body.list === "include" || body.list === "exclude")) {
    // ── Exception par entité ──
    const entityKey = body.entityKey.slice(0, 200);
    const current = new Set(readList(body.list));
    if (body.enabled) current.add(entityKey);
    else current.delete(entityKey);
    cfg[body.list] = [...current];
    // Cohérence : une entité ne peut pas être dans les deux listes.
    const other = body.list === "include" ? "exclude" : "include";
    cfg[other] = readList(other).filter((k) => k !== entityKey);
  } else {
    // ── Mode global de la famille (exceptions conservées) ──
    globalEnabled = body.enabled;
  }

  const { error } = await supabase
    .from("entity_resolution_config")
    .upsert(
      { organization_id: orgId, rule_id: `auto_action_${key}`, enabled: globalEnabled, config: cfg, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,rule_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key, enabled: globalEnabled, config: cfg });
}
