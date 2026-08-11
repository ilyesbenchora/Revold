import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Active/désactive un outil dans le mapping des identifiants.
 * Stocké dans entity_resolution_config sous rule_id `mapping_<provider>` —
 * le moteur de résolution ignore ces lignes (filtrées par COMPANY/CONTACT_RULE_IDS).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { provider?: string; enabled?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.provider || typeof body.enabled !== "boolean" || !/^[a-z0-9_-]+$/i.test(body.provider)) {
    return NextResponse.json({ error: "provider et enabled requis" }, { status: 400 });
  }

  const { error } = await supabase.from("entity_resolution_config").upsert(
    {
      organization_id: orgId,
      rule_id: `mapping_${body.provider}`,
      enabled: body.enabled,
      config: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,rule_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
