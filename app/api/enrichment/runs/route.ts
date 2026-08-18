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
 * Passes d'enrichissement (CTA « Enrichir mon CRM ») :
 *  - GET  : historique des passes (date/heure, champs couverts, compteurs),
 *           complété d'une passe DÉRIVÉE des données pour l'enrichissement
 *           initial fait avant l'existence de cette table ;
 *  - POST : { action: "start" }  → ouvre une passe. Si de NOUVEAUX champs ont
 *           été cochés depuis la dernière passe, les fiches à compléter sont
 *           remises en file (enriched_at → null) : la passe ne porte QUE sur
 *           la nouvelle donnée, la donnée déjà écrite n'est jamais retirée.
 *           { action: "finish" } → clôt la passe avec ses compteurs.
 */

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  fields: string[];
  scope_total: number;
  stats: Record<string, number>;
  status: "running" | "done" | "interrupted";
  derived?: boolean;
};

const FIELD_IDS = Object.keys(ENRICHMENT_FIELD_COLUMNS) as (keyof EnrichmentFields)[];
/** Champs actifs par défaut avant l'existence des passes (enrichissement initial). */
const LEGACY_FIELDS = FIELD_IDS.filter((f) => DEFAULT_ENRICHMENT_SETTINGS.fields[f]);

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let runs: RunRow[] = [];
  try {
    const { data } = await supabase
      .from("enrichment_runs")
      .select("id, started_at, finished_at, fields, scope_total, stats, status")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(20);
    runs = (data ?? []) as RunRow[];
  } catch {
    /* table absente (migration non appliquée) → seul l'historique dérivé s'affiche */
  }

  // Passe(s) DÉRIVÉE(S) : l'enrichissement fait AVANT l'existence de la table
  // (le premier passage du moteur) reste visible — reconstruit depuis les
  // horodatages enriched_at réels, groupés par jour.
  const firstRecorded = runs.length > 0 ? runs[runs.length - 1].started_at : null;
  try {
    const byDay = new Map<string, { min: string; max: string; count: number }>();
    for (let page = 0; page < 10; page++) {
      let q = supabase
        .from("companies")
        .select("enriched_at")
        .eq("organization_id", orgId)
        .not("enriched_at", "is", null)
        .order("enriched_at", { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      if (firstRecorded) q = q.lt("enriched_at", firstRecorded);
      const { data, error } = await q;
      if (error || !data) break;
      for (const r of data as { enriched_at: string }[]) {
        const day = r.enriched_at.slice(0, 10);
        const cur = byDay.get(day);
        if (!cur) byDay.set(day, { min: r.enriched_at, max: r.enriched_at, count: 1 });
        else {
          cur.count++;
          if (r.enriched_at > cur.max) cur.max = r.enriched_at;
        }
      }
      if (data.length < 1000) break;
    }
    const derived: RunRow[] = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 10)
      .map(([day, g]) => ({
        id: `derived-${day}`,
        started_at: g.min,
        finished_at: g.max,
        fields: LEGACY_FIELDS,
        scope_total: g.count,
        stats: { facts: g.count },
        status: "done" as const,
        derived: true,
      }));
    runs = [...runs, ...derived];
  } catch {
    /* colonne absente → pas d'historique dérivé */
  }

  // Champs déjà couverts par une passe terminée (ou par l'enrichissement
  // initial dérivé) — sert à détecter les NOUVEAUX champs cochés depuis.
  const lastDone = runs.find((r) => r.status !== "running");
  const covered = lastDone ? lastDone.fields : [];

  return NextResponse.json({ runs, covered });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { action?: string; runId?: string; stats?: Record<string, number>; status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  if (body.action === "finish") {
    if (!body.runId) return NextResponse.json({ error: "runId requis" }, { status: 400 });
    const { error } = await supabase
      .from("enrichment_runs")
      .update({
        finished_at: new Date().toISOString(),
        stats: body.stats ?? {},
        status: body.status === "interrupted" ? "interrupted" : "done",
      })
      .eq("id", body.runId)
      .eq("organization_id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "start") return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  const settings = await getEnrichmentSettings(supabase, orgId);
  const activeFields = FIELD_IDS.filter((f) => settings.fields[f]);

  // Champs couverts par la dernière passe terminée (repli : enrichissement
  // initial → champs par défaut, dès lors que des fiches sont déjà enrichies).
  let covered: string[] = [];
  try {
    const { data } = await supabase
      .from("enrichment_runs")
      .select("fields")
      .eq("organization_id", orgId)
      .neq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.fields) covered = data.fields as string[];
  } catch { /* table absente */ }
  if (covered.length === 0) {
    const { count } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("enriched_at", "is", null);
    if ((count ?? 0) > 0) covered = LEGACY_FIELDS;
  }
  const newFields = activeFields.filter((f) => !covered.includes(f));

  // Nouveaux champs cochés → remise en file des fiches où ils manquent : le
  // moteur repasse dessus et ne remplit QUE les champs vides (rien n'est
  // écrasé), donc la passe ne porte que sur la nouvelle donnée.
  if (newFields.length > 0) {
    const missing = newFields.map((f) => `${ENRICHMENT_FIELD_COLUMNS[f]}.is.null`).join(",");
    await supabase
      .from("companies")
      .update({ enriched_at: null })
      .eq("organization_id", orgId)
      .not("siren", "is", null)
      .or(missing);
  }

  // Périmètre de la passe = ce qui reste à traiter à l'instant du lancement.
  const recheckBefore = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const refreshBefore = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const countScope = async (apply: (q: unknown) => unknown): Promise<number> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = (await apply(
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      )) as any;
      return count ?? 0;
    } catch {
      return 0;
    }
  };
  const [identities, facts] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countScope((q: any) =>
      q
        .is("siren", null)
        .not("name", "is", null)
        .is("candidate_siren", null)
        .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countScope((q: any) => q.not("siren", "is", null).or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)),
  ]);
  const scopeTotal = identities + facts;

  let runId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("enrichment_runs")
      .insert({
        organization_id: orgId,
        fields: activeFields,
        scope_total: scopeTotal,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (!error) runId = data.id as string;
  } catch { /* table absente → la passe tourne sans historique */ }

  return NextResponse.json({ runId, scopeTotal, newFields, activeFields });
}
