import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";
import { runEnrichmentBatch } from "@/lib/enrichment/backfill-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * APERÇU fiche par fiche des entreprises en attente d'enrichissement — la
 * fenêtre de la tour de contrôle les affiche une par une (infos clés) avec
 * exécution immédiate par fiche. Mêmes critères de file que le moteur.
 * GET  : la liste des fiches en attente (identité d'abord, puis faits).
 * POST : { companyId } → traite CETTE fiche maintenant (budget dédié) et
 *        renvoie son nouvel état pour afficher le résultat honnêtement.
 */

const RECHECK_DAYS = 30;
const REFRESH_DAYS = 90;

type PendingCompany = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  siren: string | null;
  candidate_siren: string | null;
  candidate_legal_name: string | null;
  duplicate_of_siren: string | null;
  legal_name: string | null;
  official_employee_range: string | null;
  official_revenue: number | null;
  enriched_at: string | null;
  sirene_checked_at: string | null;
};

const COMPANY_COLS =
  "id, name, domain, industry, siren, candidate_siren, candidate_legal_name, duplicate_of_siren, legal_name, official_employee_range, official_revenue, enriched_at, sirene_checked_at";

async function fetchPending(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  limit: number,
): Promise<Array<PendingCompany & { kind: "identity" | "facts" }>> {
  const now = Date.now();
  const recheckBefore = new Date(now - RECHECK_DAYS * 86_400_000).toISOString();
  const refreshBefore = new Date(now - REFRESH_DAYS * 86_400_000).toISOString();
  const [ids, facts] = await Promise.all([
    supabase
      .from("companies")
      .select(COMPANY_COLS)
      .eq("organization_id", orgId)
      .is("siren", null)
      .not("name", "is", null)
      .is("candidate_siren", null)
      .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`)
      .order("sirene_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit),
    supabase
      .from("companies")
      .select(COMPANY_COLS)
      .eq("organization_id", orgId)
      .not("siren", "is", null)
      .or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)
      .order("enriched_at", { ascending: true, nullsFirst: true })
      .limit(limit),
  ]);
  const identities = ((ids.data ?? []) as PendingCompany[]).map((c) => ({ ...c, kind: "identity" as const }));
  const factRows = ((facts.data ?? []) as PendingCompany[]).map((c) => ({ ...c, kind: "facts" as const }));
  // Identités d'abord (« fiches à traiter » du brief), faits ensuite.
  return [...identities, ...factRows].slice(0, limit);
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const settings = await getEnrichmentSettings(supabase, orgId);
  const limitRaw = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 8;
  const pending = await fetchPending(supabase, orgId, limit);
  return NextResponse.json({ activated: settings.activated, pending });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let companyId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.companyId === "string" && body.companyId) companyId = body.companyId;
  } catch { /* corps vide */ }
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  // OPT-IN respecté : moteur jamais activé → rien n'est traité ici.
  const settings = await getEnrichmentSettings(supabase, orgId);
  if (!settings.activated) return NextResponse.json({ ok: true, inactive: true });

  // Fiche appartenant à l'org (RLS + garde explicite).
  const { data: before } = await supabase
    .from("companies")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", companyId)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

  // Budget 2 : identité + faits de la même fiche dans la foulée si possible.
  const result = await runEnrichmentBatch(supabase, { orgId, companyId, budget: 2 });

  const { data: after } = await supabase
    .from("companies")
    .select(COMPANY_COLS)
    .eq("organization_id", orgId)
    .eq("id", companyId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    counts: {
      identities: result.identities,
      candidates: result.candidates,
      facts: result.facts,
      duplicates: result.duplicates,
    },
    company: after ?? null,
  });
}
