/**
 * POST /api/integrations/hubspot/disconnect
 *
 * Supprime la ligne HubSpot de `integrations` (hard delete).
 * On ne garde pas de soft-delete : les lignes orphelines pollueraient la
 * détection OAuth et empêcheraient un fresh re-connect.
 * L'historique de sync reste dans `sync_logs`.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("integrations")
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");

  if (error) {
    console.error("[hubspot disconnect]", { orgId, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
