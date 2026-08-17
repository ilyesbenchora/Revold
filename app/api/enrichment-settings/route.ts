import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { DEFAULT_ENRICHMENT_SETTINGS, type EnrichmentFields } from "@/lib/enrichment/settings";

export const dynamic = "force-dynamic";

/** Enregistre (upsert) les réglages d'enrichissement de l'organisation. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { fields?: unknown; hubspot_search_ids?: boolean; linkedin_enabled?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const fields: Record<string, boolean> = {};
  if (body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)) {
    for (const k of Object.keys(DEFAULT_ENRICHMENT_SETTINGS.fields) as (keyof EnrichmentFields)[]) {
      const v = (body.fields as Record<string, unknown>)[k];
      if (typeof v === "boolean") fields[k] = v;
    }
  }

  const row = {
    fields,
    hubspot_search_ids: body.hubspot_search_ids !== false,
    linkedin_enabled: body.linkedin_enabled === true,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: readErr } = await supabase
    .from("enrichment_settings")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (readErr && /enrichment_settings/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260817000002_enrichment_settings non appliquée (table absente)." },
      { status: 500 },
    );
  }
  const { error } = existing
    ? await supabase.from("enrichment_settings").update(row).eq("id", existing.id)
    : await supabase.from("enrichment_settings").insert({ organization_id: orgId, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
