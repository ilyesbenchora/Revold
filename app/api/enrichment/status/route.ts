import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * ÉTAT PERSISTANT de l'enrichissement (lu en base, jamais en session) : la
 * progression survit à la navigation, au rechargement et au changement de
 * poste — c'est l'avancement RÉEL de la base, pas celui d'un run.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const recheckBefore = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const refreshBefore = new Date(Date.now() - 90 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (apply: (q: any) => any): Promise<number | null> => {
    try {
      const { count: n, error } = await apply(
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      );
      return error ? null : (n ?? 0);
    } catch {
      return null;
    }
  };

  const [total, withSiren, withEmployees, withRevenue, candidates, identitiesRemaining, factsRemaining] =
    await Promise.all([
      count((q) => q),
      count((q) => q.not("siren", "is", null)),
      count((q) => q.not("official_employee_range", "is", null)),
      count((q) => q.not("official_revenue", "is", null)),
      count((q) => q.is("siren", null).not("candidate_siren", "is", null)),
      // Identités restant à chercher : sans SIREN, avec un nom, pas déjà en
      // file de validation, jamais scannées (ou scannées il y a > 30 j).
      count((q) =>
        q
          .is("siren", null)
          .not("name", "is", null)
          .is("candidate_siren", null)
          .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`),
      ),
      // Effectifs/CA restant à (re)charger : avec SIREN, jamais enrichis ou > 90 j.
      count((q) => q.not("siren", "is", null).or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)),
    ]);

  // Dernière avancée réelle (preuve que le robot travaille) : le plus récent
  // des marqueurs écrits par le moteur, quelle que soit sa source (cron ou page).
  const lastOf = async (col: "sirene_checked_at" | "enriched_at"): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from("companies")
        .select(col)
        .eq("organization_id", orgId)
        .not(col, "is", null)
        .order(col, { ascending: false })
        .limit(1)
        .maybeSingle();
      return ((data as Record<string, unknown> | null)?.[col] as string | undefined) ?? null;
    } catch {
      return null;
    }
  };
  const [lastChecked, lastEnriched] = await Promise.all([lastOf("sirene_checked_at"), lastOf("enriched_at")]);
  const lastActivityAt = [lastChecked, lastEnriched].filter(Boolean).sort().pop() ?? null;

  const remaining = (identitiesRemaining ?? 0) + (factsRemaining ?? 0);
  // Dénominateur du chantier : ce qui reste + ce qui est déjà acquis
  // (identifiants trouvés + candidats en attente de validation).
  const processed = (withSiren ?? 0) + (candidates ?? 0);
  const scope = processed + remaining;
  const pct = scope > 0 ? Math.min(100, Math.round((processed / scope) * 100)) : 100;

  return NextResponse.json({
    total,
    withSiren,
    withEmployees,
    withRevenue,
    candidates,
    identitiesRemaining,
    factsRemaining,
    remaining,
    processed,
    pct,
    lastActivityAt,
    /** Il reste du travail → le robot (cron 10 min) le traite : « en cours ». */
    inProgress: remaining > 0,
  });
}
