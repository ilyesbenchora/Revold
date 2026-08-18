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

  const [total, withSiren, withEmployees, withRevenue, candidates, duplicates, identitiesRemaining, factsRemaining] =
    await Promise.all([
      count((q) => q),
      count((q) => q.not("siren", "is", null)),
      count((q) => q.not("official_employee_range", "is", null)),
      count((q) => q.not("official_revenue", "is", null)),
      count((q) => q.is("siren", null).not("candidate_siren", "is", null)),
      // Fiches désignant une entreprise déjà présente (doublon CRM détecté).
      count((q) => q.not("duplicate_of_siren", "is", null)),
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

  // Couverture PAR CHAMP d'enrichissement (tuiles et modale de complétion
  // corrélées aux champs cochés dans Paramètres → Enrichissement).
  const fieldIds = Object.keys(ENRICHMENT_FIELD_COLUMNS) as (keyof typeof ENRICHMENT_FIELD_COLUMNS)[];
  const fieldCountValues = await Promise.all(
    fieldIds.map((f) => count((q) => q.not(ENRICHMENT_FIELD_COLUMNS[f], "is", null))),
  );
  const fieldCounts = Object.fromEntries(fieldIds.map((f, i) => [f, fieldCountValues[i]]));

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

  // ── Nouveaux champs cochés (jamais couverts par une passe) : la jauge
  // change de CHANTIER — elle mesure la couverture de la NOUVELLE donnée
  // uniquement, et repart donc de ZÉRO (et non d'un % de la base entière :
  // c'est ce qui affichait « 53 % » à l'activation du statut juridique).
  // Une fois le champ couvert par une passe, la jauge redevient globale et
  // seul le marqueur enriched_at fait foi : une donnée légitimement absente
  // (CA confidentiel, effectif non publié) ne la bloque pas à jamais.
  const engineRemaining = (identitiesRemaining ?? 0) + (factsRemaining ?? 0);
  let remaining = engineRemaining;
  let processed = (withSiren ?? 0) + (candidates ?? 0) + (duplicates ?? 0);
  let pct: number;
  let newFieldScope = 0;
  try {
    const settings = await getEnrichmentSettings(supabase, orgId);
    const fieldIdsAll = Object.keys(ENRICHMENT_FIELD_COLUMNS) as (keyof EnrichmentFields)[];
    const active = fieldIdsAll.filter((f) => settings.fields[f]);
    // Champs couverts = ceux de la dernière passe terminée ; repli : défauts
    // historiques dès lors que des fiches ont déjà été enrichies (même logique
    // que /api/enrichment/runs).
    let coveredFields: string[] = [];
    try {
      const { data } = await supabase
        .from("enrichment_runs")
        .select("fields")
        .eq("organization_id", orgId)
        .neq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.fields) coveredFields = data.fields as string[];
    } catch { /* table absente */ }
    if (coveredFields.length === 0) {
      const anyEnriched = await count((q) => q.not("enriched_at", "is", null));
      if ((anyEnriched ?? 0) > 0) coveredFields = fieldIdsAll.filter((f) => DEFAULT_ENRICHMENT_SETTINGS.fields[f]);
    }
    const newFields = active.filter((f) => f !== "siren" && !coveredFields.includes(f));
    if (newFields.length > 0 && (withSiren ?? 0) > 0) {
      const missing = newFields.map((f) => `${ENRICHMENT_FIELD_COLUMNS[f]}.is.null`).join(",");
      // Périmètre du chantier = fiches identifiées (le registre se lit par
      // SIREN) ; manquantes = au moins une nouvelle donnée absente.
      newFieldScope = withSiren ?? 0;
      const missingNew = (await count((q) => q.not("siren", "is", null).or(missing))) ?? 0;
      processed = Math.max(0, newFieldScope - missingNew);
      remaining = missingNew + engineRemaining;
    }
  } catch {
    newFieldScope = 0;
  }

  if (newFieldScope > 0) {
    // Jauge du chantier « nouvelle donnée » : 0 % au départ, 100 % couvert.
    pct = Math.max(0, Math.min(100, Math.round((processed / newFieldScope) * 100)));
  } else {
    // Jauge globale = fiches à jour / base totale.
    const base = total ?? processed + remaining;
    pct = base > 0 ? Math.max(0, Math.min(100, Math.round(((base - remaining) / base) * 100))) : 100;
  }

  return NextResponse.json({
    total,
    withSiren,
    withEmployees,
    withRevenue,
    fieldCounts,
    candidates,
    duplicates,
    identitiesRemaining,
    factsRemaining,
    remaining,
    processed,
    pct,
    lastActivityAt,
    /** Travail en FILE (remis en file) → le robot le traite : « en cours ».
     *  Les champs jamais couverts (newFieldsRemaining) attendent le clic
     *  « Enrichir mon CRM » : la jauge baisse mais l'état reste « à lancer ». */
    inProgress: (identitiesRemaining ?? 0) + (factsRemaining ?? 0) > 0,
  });
}
