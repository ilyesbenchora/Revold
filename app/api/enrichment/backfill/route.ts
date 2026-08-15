import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/supabase/cached";
import { runEnrichmentBatch } from "@/lib/enrichment/backfill-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * « Enrichir toute ma base MAINTENANT » — un appel traite un lot (~60 lookups,
 * ≈ 30 s) pour l'org courante ; l'UI boucle tant qu'il reste des entreprises,
 * avec progression visible. Même moteur que le cron horaire (backfill-engine) :
 * correspondances sûres appliquées, plausibles en file de validation persistante.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Service role : le moteur écrit aussi les colonnes d'état (RLS-safe car
  // scope org imposé) et lit les tokens HubSpot.
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    remainingIdentities: result.remainingIdentities,
    remainingFacts: result.remainingFacts,
  });
}
