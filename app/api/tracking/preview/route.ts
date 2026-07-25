import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveTrackingSpec } from "@/lib/alerts/resolve-tracking-spec";
import { loadEntitiesWithData } from "@/lib/alerts/entity-readiness";
import { valueFromAggSpec } from "@/lib/alerts/agg-value";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { computeReconciledMetric } from "@/lib/reconciliation/engine";
import { trackingLabel } from "@/lib/alerts/tracking-label";
import { countEntityRows } from "@/lib/reports/resolve-custom-kpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Étape « Vérification » des alertes et objectifs : l'agent rattache le KPI aux
 * vraies données et renvoie une PROPOSITION de câblage (voie réconciliée /
 * indicateur catalogué / agrégat canonique) + la valeur actuelle calculée +
 * les volumes réels par entité — SANS rien créer. L'utilisateur confirme, ou
 * impose une entité (`entity`) → nouveau câblage contraint. La création envoie
 * ensuite le câblage confirmé tel quel (forecast_type / agg_spec / recon_recipe).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    kpi_text?: string; description?: string; team?: string; category?: string;
    value?: number; unit?: string; entity?: string;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const kpiText = (body.kpi_text || "").trim();
  if (!kpiText) return NextResponse.json({ error: "KPI requis" }, { status: 400 });
  const preferredEntity = typeof body.entity === "string" && body.entity.trim() ? body.entity.trim() : null;

  const token = await getHubSpotToken(supabase, orgId);
  const [availableEntities, counts] = await Promise.all([
    loadEntitiesWithData(supabase, orgId).then((s) => [...s]),
    countEntityRows(supabase, orgId, []),
  ]);

  const r = await resolveTrackingSpec(supabase, orgId, token, {
    kpiText,
    description: typeof body.description === "string" ? body.description : null,
    team: typeof body.team === "string" ? body.team : null,
    category: typeof body.category === "string" ? body.category : null,
    value: typeof body.value === "number" ? body.value : null,
    unit: typeof body.unit === "string" ? body.unit : null,
    availableEntities,
    preferredEntity,
  });

  // Valeur actuelle réelle du câblage proposé — la preuve du matching.
  let currentValue: number | null = null;
  try {
    if (r.recon_recipe) {
      const res = await computeReconciledMetric(supabase, orgId, r.recon_recipe);
      currentValue = res && res.hasData ? res.value : null;
    } else if (r.forecast_type) {
      currentValue = await resolveKpiValue(supabase, orgId, r.forecast_type, {});
    } else if (r.agg_spec) {
      currentValue = await valueFromAggSpec(supabase, orgId, token, r.agg_spec);
    }
  } catch {
    /* valeur non calculable → null, affiché comme tel */
  }

  const mode = r.recon_recipe ? "reconciled" : r.forecast_type ? "forecast" : r.agg_spec ? "aggregate" : null;
  if (!mode) return NextResponse.json({ error: "Aucun câblage trouvé pour ce KPI." , counts }, { status: 422 });

  return NextResponse.json({
    resolution: {
      mode,
      forecast_type: r.forecast_type,
      recon_recipe: r.recon_recipe,
      agg_spec: r.agg_spec,
      label: trackingLabel(r.forecast_type, r.agg_spec, r.recon_recipe),
      current_value: currentValue,
      unit_mode: r.agg_spec?.unit_mode ?? body.unit ?? null,
    },
    counts,
  });
}
