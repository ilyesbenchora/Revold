import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveCustomKpiSpec } from "@/lib/reports/resolve-custom-kpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLE_COLS = "id, page_key, title, entity, group_by, measure, field, unit_mode, view, custom_kpi, description, created_at";

/**
 * Édite une table de données.
 *  - Titre / affichage (view) → mise à jour directe, SANS agent (simple nomenclature).
 *  - Réécriture du KPI personnalisé → l'agent recalcule la donnée (entité/dimension/
 *    mesure/champ) de façon fiable, puis on met à jour.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { id } = await params;
  let body: { title?: string; view?: string; custom_kpi?: string; description?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const { data: existing } = await supabase
    .from("page_data_tables")
    .select(TABLE_COLS)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Table introuvable" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body.view === "string" && body.view) update.view = body.view;

  // Réécriture du KPI ou de sa description → on refait passer l'agent (uniquement
  // si l'un des deux textes change ; la description affine l'interprétation).
  const newKpi = typeof body.custom_kpi === "string" ? body.custom_kpi.trim() : null;
  const newDescription = typeof body.description === "string" ? body.description.trim() : null;
  const kpiChanged = newKpi !== null && newKpi !== (existing.custom_kpi ?? "");
  const descriptionChanged = newDescription !== null && newDescription !== ((existing.description as string | null) ?? "");
  let agentName: string | null = null;
  if (kpiChanged || descriptionChanged) {
    const effectiveKpi = newKpi || (existing.custom_kpi as string | null) || "";
    if (!effectiveKpi) return NextResponse.json({ error: "KPI personnalisé requis" }, { status: 400 });
    const effectiveDescription = newDescription ?? (existing.description as string | null);
    const hubspotToken = await getHubSpotToken(supabase, orgId);
    const resolved = await resolveCustomKpiSpec(supabase, orgId, hubspotToken, existing.page_key as string, effectiveKpi, effectiveDescription);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    agentName = resolved.agentName;
    update.custom_kpi = effectiveKpi;
    if (newDescription !== null) update.description = newDescription || null;
    update.entity = resolved.spec.entity;
    update.group_by = resolved.spec.groupBy;
    update.measure = resolved.spec.measure || "count";
    update.field = resolved.spec.field ?? null;
    update.unit_mode = resolved.unitMode;
    // Le titre reste la nomenclature de l'utilisateur : on ne le touche PAS ici
    // (il se renomme séparément en ligne, sans agent).
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ table: existing });
  }

  const { data, error } = await supabase
    .from("page_data_tables")
    .update(update)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select(TABLE_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data, agent: agentName });
}

/** Supprime une table de données. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { id } = await params;
  const { error } = await supabase
    .from("page_data_tables")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
