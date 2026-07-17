import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate, type AggregateSpec } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Recalcul DÉTERMINISTE d'un graphique pour une période (aucune IA) : ré-exécute
 * la même requête aggregate_canonical avec de nouvelles bornes de dates. Garantit
 * des chiffres 100 % fiables et cohérents quand l'utilisateur change la période.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    query?: { entity?: string; groupBy?: string; measure?: string; field?: string };
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
    date_from: from,
    date_to: to,
  };

  try {
    const result = await computeAggregate(supabase, orgId, sources, hubspotToken, spec);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    const rows = (result.rows as { group: string; value: number }[] | undefined) ?? [];
    // Format attendu par le graphique : { name, value }.
    return NextResponse.json({
      data: rows.map((r) => ({ name: r.group, value: r.value })),
      totalRows: result.totalRows ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur de recalcul" }, { status: 500 });
  }
}
