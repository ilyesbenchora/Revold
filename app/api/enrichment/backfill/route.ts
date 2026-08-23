import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/supabase/cached";
import { runEnrichmentBatch } from "@/lib/enrichment/backfill-engine";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * « Enrichir toute ma base MAINTENANT » — un appel traite un lot (~60 lookups,
 * ≈ 30 s) pour l'org courante ; l'UI boucle tant qu'il reste des entreprises,
 * avec progression visible. Même moteur que le cron horaire (backfill-engine) :
 * correspondances sûres appliquées, plausibles en file de validation persistante.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Service role : le moteur écrit aussi les colonnes d'état (RLS-safe car
  // scope org imposé) et lit les tokens HubSpot.
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ── OPT-IN : le moteur ne tourne JAMAIS sans clic sur « Enrichir mon CRM ».
  // Le CTA envoie { activate: true } (posé une fois, persistant) ; les appels
  // de fond (accélérateur du layout) sans activation → no-op propre.
  const body = (await request.json().catch(() => ({}))) as { activate?: boolean };
  const settings = await getEnrichmentSettings(sb, orgId);
  if (!settings.activated && body.activate !== true) {
    return NextResponse.json({
      ok: true,
      inactive: true,
      lookupsUsed: 0, identities: 0, candidates: 0, facts: 0, duplicates: 0,
      remainingIdentities: 0, remainingFacts: 0, interrupted: false,
    });
  }
  if (!settings.activated && body.activate === true) {
    const { data: existing } = await sb
      .from("enrichment_settings")
      .select("organization_id")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (existing) {
      await sb.from("enrichment_settings").update({ activated_at: new Date().toISOString() }).eq("organization_id", orgId);
    } else {
      await sb.from("enrichment_settings").insert({ organization_id: orgId, activated_at: new Date().toISOString() });
    }
  }

  const result = await runEnrichmentBatch(sb, { orgId, budget: 60 });
  if (result.unavailable) {
    return NextResponse.json({ error: "Migration enrichment_scale non appliquée — redéploie puis réessaie." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    lookupsUsed: result.lookupsUsed,
    identities: result.identities,
    candidates: result.candidates,
    facts: result.facts,
    duplicates: result.duplicates,
    remainingIdentities: result.remainingIdentities,
    remainingFacts: result.remainingFacts,
    interrupted: result.interrupted ?? false,
  });
}
