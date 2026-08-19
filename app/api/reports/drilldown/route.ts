import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate, type AggregateSpec } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DÉTAIL d'un chiffre de rapport (drill-down) : renvoie les enregistrements
 * sous-jacents (contacts, deals, factures, abonnements, transactions…) d'un
 * bucket d'agrégat — mêmes filtres déterministes que le recalcul (sources,
 * période, pipeline, fréquence), aucune IA.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    query?: {
      entity?: string; groupBy?: string; measure?: string; field?: string; pipeline?: string | null; granularity?: string | null;
      /** Filtre cohorte (segment / industry de l'entreprise) — même scoping que l'agrégat. */
      cohort?: { key?: string; value?: string } | null;
    };
    /** Clé BRUTE du bucket cliqué (« 2026-01 », « Closed won »…) — null = tous. */
    bucket?: string | null;
    date_from?: string;
    date_to?: string;
    all?: boolean;
    sources?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const q = body.query;
  if (!q || typeof q.entity !== "string" || typeof q.groupBy !== "string") {
    return NextResponse.json({ error: "Requête déterministe absente" }, { status: 400 });
  }
  const from = !body.all && body.date_from && dateRe.test(body.date_from) ? body.date_from : null;
  const to = !body.all && body.date_to && dateRe.test(body.date_to) ? body.date_to : null;
  const sources = Array.isArray(body.sources) ? body.sources.filter((s) => typeof s === "string") : [];

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const spec: AggregateSpec = {
    entity: q.entity,
    groupBy: q.groupBy,
    measure: q.measure,
    field: q.field ?? null,
    pipeline: typeof q.pipeline === "string" && q.pipeline.trim() ? q.pipeline.trim() : null,
    granularity: typeof q.granularity === "string" && q.granularity.trim() ? q.granularity.trim() : null,
    date_from: from,
    date_to: to,
    cohort:
      q.cohort && typeof q.cohort.key === "string" && typeof q.cohort.value === "string" && q.cohort.value
        ? { key: q.cohort.key, value: q.cohort.value }
        : null,
    detail: true,
    detailBucket: typeof body.bucket === "string" && body.bucket ? body.bucket : null,
  };

  try {
    const result = await computeAggregate(supabase, orgId, sources, hubspotToken, spec);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      columns: result.columns ?? [],
      records: result.records ?? [],
      totalRecords: result.totalRecords ?? 0,
      truncated: result.truncated ?? false,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur de détail" }, { status: 500 });
  }
}
