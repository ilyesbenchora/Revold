/**
 * API onboarding — GET et PATCH de l'état du wizard.
 *
 * Authentification : user authentifié ; les RLS de onboarding_state
 * garantissent qu'on ne touche que sa propre org.
 *
 * PATCH body : { step?: "welcomed"|"objectives"|"first_sync"|"completed", objectives?: string[], skip?: boolean }
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "auth" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return NextResponse.json({ state: data ?? null });
}

export async function PATCH(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "auth" }, { status: 401 });
  const supabase = await createSupabaseServerClient();

  const body = (await req.json().catch(() => ({}))) as {
    step?: "welcomed" | "hubspot" | "objectives" | "first_sync" | "completed";
    objectives?: string[];
    skip?: boolean;
  };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    organization_id: orgId,
    updated_at: now,
  };
  if (body.step === "welcomed") patch.welcomed_at = now;
  if (body.step === "hubspot") patch.hubspot_connected_at = now;
  if (body.step === "objectives") {
    patch.objectives_set_at = now;
    if (Array.isArray(body.objectives)) patch.objectives = body.objectives;
  }
  if (body.step === "first_sync") patch.first_sync_seen_at = now;
  if (body.step === "completed") patch.completed_at = now;
  if (body.skip) patch.skipped = true;

  const { error } = await supabase
    .from("onboarding_state")
    .upsert(patch, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
