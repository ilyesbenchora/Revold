import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Identifiants d'entités (SIREN/SIRET) par hubspot_id — colonnes clés de la
 * table de validation des hiérarchies. Servis en direct depuis la base pour
 * couvrir aussi les suggestions créées avant l'ajout de ces colonnes.
 * SIREN : celui de la fiche, sinon celui du doublon détecté (même société).
 * SIRET : celui appliqué, sinon le candidat d'établissement conservé.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{1,20}$/.test(s))
    .slice(0, 300);
  if (ids.length === 0) return NextResponse.json({ companies: {} });

  type IdentRow = { hubspot_id: string | null; siren: string | null; siret: string | null; duplicate_of_siren: string | null; candidate_siret: string | null };
  let data: IdentRow[] | null = null;
  const full = await supabase
    .from("companies")
    .select("hubspot_id, siren, siret, duplicate_of_siren, candidate_siret")
    .eq("organization_id", orgId)
    .in("hubspot_id", ids);
  if (!full.error) {
    data = (full.data ?? []) as unknown as IdentRow[];
  } else {
    // Colonnes d'enrichissement absentes (migration non appliquée) → sans elles.
    const basic = await supabase
      .from("companies")
      .select("hubspot_id, siren, siret")
      .eq("organization_id", orgId)
      .in("hubspot_id", ids);
    data = ((basic.data ?? []) as Array<{ hubspot_id: string | null; siren: string | null; siret: string | null }>)
      .map((c) => ({ ...c, duplicate_of_siren: null, candidate_siret: null }));
  }

  const companies: Record<string, { siren: string | null; siret: string | null }> = {};
  for (const c of data ?? []) {
    if (!c.hubspot_id) continue;
    companies[String(c.hubspot_id)] = {
      siren: c.siren ?? c.duplicate_of_siren ?? null,
      siret: c.siret ?? c.candidate_siret ?? null,
    };
  }
  return NextResponse.json({ companies });
}
