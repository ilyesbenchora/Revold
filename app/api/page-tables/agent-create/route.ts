import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveCustomKpiSpec } from "@/lib/reports/resolve-custom-kpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_key?: string; custom_kpi?: string; description?: string; view?: string; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const pageKey = body.page_key;
  const kpi = (body.custom_kpi || "").trim();
  const description = (body.description || "").trim() || null;
  const view = body.view || "table";
  if (!pageKey || !kpi) return NextResponse.json({ error: "KPI personnalisé requis" }, { status: 400 });

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const resolved = await resolveCustomKpiSpec(supabase, orgId, hubspotToken, pageKey, kpi, description);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  // Le titre part TOUJOURS du KPI écrit par l'utilisateur ; l'agent ne fait que
  // le peaufiner à défaut (si l'utilisateur n'a rien saisi).
  const title = body.title?.trim() || resolved.agentTitle || kpi;

  const { data, error } = await supabase
    .from("page_data_tables")
    .insert({
      organization_id: orgId,
      page_key: pageKey,
      title,
      entity: resolved.spec.entity,
      group_by: resolved.spec.groupBy,
      measure: resolved.spec.measure || "count",
      field: resolved.spec.field ?? null,
      unit_mode: resolved.unitMode,
      view,
      custom_kpi: kpi,
      description,
      created_by: user.id,
    })
    .select("id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data, agent: resolved.agentName });
}
