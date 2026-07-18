import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveTrackingSpec } from "@/lib/alerts/resolve-tracking-spec";
import { loadEntitiesWithData } from "@/lib/alerts/entity-readiness";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function missingColumn(message: string): string | null {
  const m = /Could not find the '([a-z_0-9]+)' column/i.exec(message)
    || /column "?([a-z_0-9]+)"? of relation/i.exec(message)
    || /column ([a-z_0-9]+) does not exist/i.exec(message);
  return m ? m[1] : null;
}

/** POST /api/objectives — crée un objectif. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  const unit = b.unit_mode === "count" ? "count" : b.unit_mode === "currency" ? "currency" : b.unit_mode === "percent" ? "percent" : null;
  const targetVal = typeof b.target === "number" ? b.target : b.target ? Number(b.target) : null;

  // Objectif rattaché aux vraies données : indicateur catalogué OU agrégat
  // (ex : « 200 M€ d'ARR » → subscriptions sum(mrr) × 12). Fallback garanti.
  let effectiveForecast = typeof b.forecast_type === "string" && b.forecast_type ? b.forecast_type : null;
  let aggSpec: Record<string, unknown> | null = null;
  let reconSpec: { recipe: string } | null = null;
  if (!effectiveForecast) {
    const token = await getHubSpotToken(supabase, orgId);
    const availableEntities = [...(await loadEntitiesWithData(supabase, orgId))];
    const r = await resolveTrackingSpec(supabase, orgId, token, {
      kpiText: title,
      description: typeof b.description === "string" ? b.description : null,
      team: typeof b.team === "string" ? b.team : null,
      category: typeof b.category === "string" ? b.category : null,
      value: targetVal,
      unit,
      availableEntities,
    });
    if (r.recon_recipe) reconSpec = { recipe: r.recon_recipe };
    else if (r.forecast_type) effectiveForecast = r.forecast_type;
    else if (r.agg_spec) aggSpec = r.agg_spec as Record<string, unknown>;
  }

  const row: Record<string, unknown> = {
    organization_id: orgId,
    created_by: user.id,
    title: title.slice(0, 200),
    description: typeof b.description === "string" ? b.description.slice(0, 2000) : null,
    impact: typeof b.impact === "string" ? b.impact.slice(0, 2000) : null,
    category: typeof b.category === "string" ? b.category : null,
    team: typeof b.team === "string" ? b.team : null,
    forecast_type: effectiveForecast,
    target: targetVal,
    unit_mode: unit,
    direction: b.direction === "below" ? "below" : "above",
    current_value: typeof b.current_value === "number" ? b.current_value : b.current_value ? Number(b.current_value) : null,
    date_from: typeof b.date_from === "string" && dateRe.test(b.date_from) ? b.date_from : null,
    date_to: typeof b.date_to === "string" && dateRe.test(b.date_to) ? b.date_to : null,
    priority: b.priority === "faible" || b.priority === "urgent" ? b.priority : "moyen",
    agg_spec: aggSpec,
    recon_spec: reconSpec,
    status: "active",
  };

  // Insert résilient : retire les colonnes non encore migrées (priority, agg_spec…) et réessaie.
  const attempt = { ...row };
  let data: { id?: string } | null = null;
  let error: { message: string } | null = null;
  for (let i = 0; i < 6; i++) {
    const res = await supabase.from("objectives").insert(attempt).select("id").single();
    data = res.data; error = res.error;
    if (!error) break;
    const col = missingColumn(error.message);
    if (col && col in attempt) { delete attempt[col]; continue; }
    break;
  }
  if (error) {
    if (/objectives/.test(error.message)) return NextResponse.json({ error: "Table objectives absente — applique la migration Supabase." }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
