import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveCustomKpiSpec, countEntityRows } from "@/lib/reports/resolve-custom-kpi";
import { cleanSources } from "@/app/api/page-tables/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Étape « Vérification » du funnel : l'agent interprète le KPI et PROPOSE un
 * câblage (entité/dimension/mesure + volume de données) SANS créer la table.
 * L'utilisateur confirme, ou impose une autre entité (`entity`) → nouvelle
 * proposition contrainte. La création/édition applique ensuite la spec validée
 * telle quelle (aucun re-passage par l'agent : ce qui est affiché est créé).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_key?: string; custom_kpi?: string; description?: string; sources?: string[]; entity?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const pageKey = body.page_key;
  const kpi = (body.custom_kpi || "").trim();
  const description = (body.description || "").trim() || null;
  const sources = cleanSources(body.sources);
  const preferredEntity = typeof body.entity === "string" && body.entity.trim() ? body.entity.trim() : null;
  if (!pageKey || !kpi) return NextResponse.json({ error: "KPI personnalisé requis" }, { status: 400 });

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const [resolved, counts] = await Promise.all([
    resolveCustomKpiSpec(supabase, orgId, hubspotToken, pageKey, kpi, description, sources, preferredEntity),
    countEntityRows(supabase, orgId, sources),
  ]);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, instructions: resolved.instructions, counts }, { status: resolved.status });
  }

  return NextResponse.json({
    proposal: {
      entity: resolved.spec.entity,
      group_by: resolved.spec.groupBy,
      measure: resolved.spec.measure || "count",
      field: resolved.spec.field ?? null,
      unit_mode: resolved.unitMode,
      pipeline: resolved.spec.pipeline ?? null,
      title: resolved.agentTitle,
      date_from: resolved.spec.date_from ?? null,
      date_to: resolved.spec.date_to ?? null,
      rowCount: resolved.rowCount,
      agent: resolved.agentName,
    },
    counts,
  });
}
