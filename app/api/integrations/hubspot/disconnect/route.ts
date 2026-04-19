/**
 * POST /api/integrations/hubspot/disconnect
 *
 * Désactive l'intégration HubSpot pour l'org courante.
 * Soft delete : on garde la ligne (pour audit) mais is_active=false +
 * tokens vidés. Sync engine et getHubSpotToken() retomberont sur le fallback
 * (env var) ou rien.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("integrations")
    .update({
      is_active: false,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");

  if (error) {
    console.error("[hubspot disconnect]", { orgId, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
