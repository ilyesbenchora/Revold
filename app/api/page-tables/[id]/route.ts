import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveCustomKpiSpec } from "@/lib/reports/resolve-custom-kpi";
import { cleanPeriod, cleanSources, TABLE_COLS, VALID_GRANULARITIES } from "@/app/api/page-tables/route";
import { PERIOD_FROM_DESCRIPTION, serializeCustomPeriod } from "@/lib/reports/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  let body: {
    title?: string; view?: string; custom_kpi?: string; description?: string; period_preset?: string; sources?: string[];
    show_total?: boolean;
    // Fréquence des dimensions temporelles (day/week/month/quarter/semester/year).
    granularity?: string | null;
    // Ordre d'affichage sur la page (drag & drop du mode personnalisation).
    position?: number;
    // Deals uniquement : pipeline ciblé (nom ou id) — évite les étapes homonymes.
    pipeline?: string | null;
    // Spec résolue et CONFIRMÉE à l'étape « Vérification » : appliquée telle
    // quelle, sans re-passage par l'agent (ce qui est affiché est enregistré).
    spec?: { entity?: string; group_by?: string; measure?: string; field?: string | null; unit_mode?: string | null; pipeline?: string | null };
  };
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
  if (typeof body.period_preset === "string") update.period_preset = cleanPeriod(body.period_preset);
  // Option d'affichage : total dans la visualisation (simple toggle, sans agent).
  if (typeof body.show_total === "boolean") update.show_total = body.show_total;
  // Ordre d'affichage (drag & drop) — simple entier, sans agent.
  if (typeof body.position === "number" && Number.isFinite(body.position)) update.position = Math.trunc(body.position);
  // Fréquence temporelle (simple option d'affichage, sans agent).
  if (body.granularity === null) update.granularity = null;
  else if (typeof body.granularity === "string" && VALID_GRANULARITIES.has(body.granularity)) update.granularity = body.granularity;
  // Pipeline ciblé (deals · regroupement par étape) — hors spec agent.
  if (body.pipeline === null) update.pipeline = null;
  else if (typeof body.pipeline === "string" && body.pipeline.trim() && !body.spec) update.pipeline = body.pipeline.trim();

  // Réécriture du KPI, de sa description OU des outils sources → on refait passer
  // l'agent (le câblage entité/dimension dépend des trois).
  const newKpi = typeof body.custom_kpi === "string" ? body.custom_kpi.trim() : null;
  const newDescription = typeof body.description === "string" ? body.description.trim() : null;
  const newSources = Array.isArray(body.sources) ? cleanSources(body.sources) : null;
  const existingSources = cleanSources(existing.sources);
  const kpiChanged = newKpi !== null && newKpi !== (existing.custom_kpi ?? "");
  const descriptionChanged = newDescription !== null && newDescription !== ((existing.description as string | null) ?? "");
  const sourcesChanged = newSources !== null && JSON.stringify(newSources) !== JSON.stringify(existingSources);
  if (sourcesChanged) update.sources = newSources;
  let agentName: string | null = null;
  // Spec confirmée à l'étape « Vérification » → application directe (pas d'agent).
  const confirmed = body.spec && typeof body.spec === "object" ? body.spec : null;
  if (confirmed && typeof confirmed.entity === "string" && confirmed.entity && typeof confirmed.group_by === "string" && confirmed.group_by) {
    update.entity = confirmed.entity;
    update.group_by = confirmed.group_by;
    update.measure = typeof confirmed.measure === "string" && confirmed.measure ? confirmed.measure : "count";
    update.field = typeof confirmed.field === "string" && confirmed.field ? confirmed.field : null;
    update.unit_mode = typeof confirmed.unit_mode === "string" && confirmed.unit_mode ? confirmed.unit_mode : null;
    update.pipeline = typeof confirmed.pipeline === "string" && confirmed.pipeline.trim() ? confirmed.pipeline.trim() : null;
    if (newKpi) update.custom_kpi = newKpi;
    if (newDescription !== null) update.description = newDescription || null;
  } else if ((kpiChanged || descriptionChanged || sourcesChanged) && (existing.custom_kpi || newKpi)) {
    const effectiveKpi = newKpi || (existing.custom_kpi as string | null) || "";
    if (!effectiveKpi) return NextResponse.json({ error: "KPI personnalisé requis" }, { status: 400 });
    const effectiveDescription = newDescription ?? (existing.description as string | null);
    const effectiveSources = newSources ?? existingSources;
    const hubspotToken = await getHubSpotToken(supabase, orgId);
    const resolved = await resolveCustomKpiSpec(supabase, orgId, hubspotToken, existing.page_key as string, effectiveKpi, effectiveDescription, effectiveSources);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    agentName = resolved.agentName;
    update.custom_kpi = effectiveKpi;
    if (newDescription !== null) update.description = newDescription || null;
    update.entity = resolved.spec.entity;
    update.group_by = resolved.spec.groupBy;
    update.measure = resolved.spec.measure || "count";
    update.field = resolved.spec.field ?? null;
    update.unit_mode = resolved.unitMode;
    update.pipeline = resolved.spec.pipeline ?? null;
    // Le titre reste la nomenclature de l'utilisateur : on ne le touche PAS ici
    // (il se renomme séparément en ligne, sans agent).

    // Période « déjà précisée dans la description » : si l'agent a extrait des
    // dates absolues du texte, on les fige en plage personnalisée — la table
    // s'ouvrira réellement filtrée sur la période décrite.
    if (update.period_preset === PERIOD_FROM_DESCRIPTION && resolved.spec.date_from && resolved.spec.date_to) {
      update.period_preset = serializeCustomPeriod(resolved.spec.date_from, resolved.spec.date_to);
    }
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
