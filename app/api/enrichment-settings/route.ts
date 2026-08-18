import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  DEFAULT_ENRICHMENT_SETTINGS,
  ENRICHMENT_FIELD_COLUMNS,
  getEnrichmentSettings,
  type EnrichmentFields,
} from "@/lib/enrichment/settings";

export const dynamic = "force-dynamic";

/**
 * Enregistre (upsert) les réglages d'enrichissement de l'organisation.
 * Un champ NOUVELLEMENT coché remet immédiatement en file les fiches où il
 * manque (enriched_at → null) : la jauge de la page Enrichissement repart
 * aussitôt (au lieu de rester à 100 % de la passe précédente) et le robot de
 * fond traite la nouvelle donnée sans attendre le clic « Enrichir mon CRM ».
 */
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

  // Réglages AVANT enregistrement — pour détecter les champs qui viennent
  // d'être cochés (false/absent → true).
  const prev = await getEnrichmentSettings(supabase, orgId);

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

  // ── Champs nouvellement cochés → remise en file immédiate ──
  // Le moteur ne remplit que les champs VIDES : remettre enriched_at à null ne
  // retire jamais une donnée, il déclenche juste un nouveau passage.
  const activated = (Object.keys(ENRICHMENT_FIELD_COLUMNS) as (keyof EnrichmentFields)[]).filter(
    (k) => fields[k] === true && !prev.fields[k],
  );
  try {
    // SIREN activé : les fiches non identifiées repartent en recherche d'identité.
    if (activated.includes("siren")) {
      await supabase
        .from("companies")
        .update({ sirene_checked_at: null })
        .eq("organization_id", orgId)
        .is("siren", null);
    }
    const factFields = activated.filter((k) => k !== "siren");
    if (factFields.length > 0) {
      const missing = factFields.map((k) => `${ENRICHMENT_FIELD_COLUMNS[k]}.is.null`).join(",");
      await supabase
        .from("companies")
        .update({ enriched_at: null })
        .eq("organization_id", orgId)
        .not("siren", "is", null)
        .or(missing);
    }
  } catch {
    /* colonne récente absente (migration non appliquée) : la remise en file se refera au lancement de la passe */
  }

  return NextResponse.json({ ok: true, requeuedFields: activated });
}
