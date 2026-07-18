import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveKpiValue, getDefaultDirection } from "@/lib/alerts/kpi-resolver";
import { insertAlertResilient } from "@/lib/alerts/resilient";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { resolveTrackingSpec } from "@/lib/alerts/resolve-tracking-spec";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const body = await request.json();
  const {
    title, description, impact, category,
    forecast_type, threshold, direction,
    // Advanced filters
    team, pipeline_id, owner_filter,
    date_from, date_to, date_preset,
    unit_mode, segment_filter, severity, frequency,
    expires_at, min_deal_amount, deal_stage_filter,
    // Priorité + période continue + contexte agent
    priority, continuous, user_context,
    // Marketing filters
    lifecycle_stage, source_filters, custom_property, custom_prop_value,
    // Notifications (Phase 8.4) — canaux à utiliser quand objectif atteint
    notification_channels,
    // Outils à croiser + KPI par source (multi-outils)
    cross_sources, threshold_secondary, unit_mode_secondary, secondary_kpis,
    // Spec d'agrégat pour tracker une alerte technique/table sur les vraies données
    agg_spec,
  } = body;

  if (!title || !description || !impact) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Compute current KPI value with filters
  let currentValue: number | null = null;
  if (forecast_type && threshold != null) {
    currentValue = await resolveKpiValue(supabase, profile.organization_id, forecast_type, {
      pipeline_id, owner_filter, date_from, date_to, date_preset,
      segment_filter, min_deal_amount, deal_stage_filter,
      lifecycle_stage, source_filters, custom_property, custom_prop_value,
    });
  }

  // Alerte personnalisée (texte libre) sans KPI catalogué ni spec fournie :
  // l'agent RATTACHE le KPI aux vraies données (indicateur catalogué OU agrégat),
  // via le nom, le chiffre et la description. Fallback déterministe garanti.
  let effectiveForecast: string | null = forecast_type || null;
  let resolvedAggSpec = agg_spec && typeof agg_spec === "object" ? agg_spec : null;
  if (!effectiveForecast && !resolvedAggSpec && typeof title === "string" && title.trim()) {
    const token = await getHubSpotToken(supabase, profile.organization_id);
    const r = await resolveTrackingSpec(supabase, profile.organization_id, token, {
      kpiText: title,
      description: typeof user_context === "string" ? user_context : (typeof description === "string" ? description : null),
      team, category,
      value: threshold != null ? Number(threshold) : null,
      unit: unit_mode,
    });
    if (r.forecast_type) effectiveForecast = r.forecast_type;
    else if (r.agg_spec) resolvedAggSpec = r.agg_spec;
  }

  const { id, error } = await insertAlertResilient(supabase, {
    organization_id: profile.organization_id,
    created_by: user.id,
    title,
    description,
    impact,
    category: category || "sales",
    status: "active",
    forecast_type: effectiveForecast,
    threshold: threshold != null ? Number(threshold) : null,
    current_value: currentValue,
    direction: direction || (forecast_type ? getDefaultDirection(forecast_type) : "above"),
    last_checked: forecast_type ? new Date().toISOString() : null,
    // Advanced
    team: team || null,
    pipeline_id: pipeline_id || null,
    owner_filter: owner_filter || null,
    date_from: date_from || null,
    date_to: date_to || null,
    date_preset: date_preset || null,
    unit_mode: unit_mode || "percent",
    segment_filter: segment_filter || null,
    severity: severity || "info",
    priority: priority || "moyen",
    continuous: continuous === true,
    user_context: user_context || null,
    frequency: frequency || "every_check",
    expires_at: expires_at || null,
    min_deal_amount: min_deal_amount != null ? Number(min_deal_amount) : null,
    deal_stage_filter: deal_stage_filter || null,
    lifecycle_stage: lifecycle_stage || null,
    source_filters: source_filters?.length ? source_filters : null,
    custom_property: custom_property || null,
    custom_prop_value: custom_prop_value || null,
    notification_channels: Array.isArray(notification_channels) && notification_channels.length > 0
      ? notification_channels
      : ["in_app"],
    // Outils à croiser + 2ᵉ KPI
    cross_sources: Array.isArray(cross_sources) && cross_sources.length ? cross_sources.slice(0, 12) : null,
    threshold_secondary: threshold_secondary != null ? Number(threshold_secondary) : null,
    unit_mode_secondary: unit_mode_secondary === "count" ? "count" : unit_mode_secondary === "currency" ? "currency" : unit_mode_secondary === "percent" ? "percent" : null,
    secondary_kpis: Array.isArray(secondary_kpis) && secondary_kpis.length ? secondary_kpis.slice(0, 12) : null,
    agg_spec: resolvedAggSpec,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });

  // Notification in-app immédiate : confirmation que l'alerte est active et
  // surveillée. (Les notifs de seuil atteint restent gérées par le cron.)
  if (id) {
    await createInAppNotification({
      orgId: profile.organization_id,
      userId: user.id,
      alertId: id,
      title: `Alerte créée : ${title}`,
      body: `Revold surveille désormais « ${title} ». Tu seras notifié dès que le KPI est atteint.`,
      link: "/dashboard/mes-alertes",
    });
  }

  return NextResponse.json({ success: true, id, current_value: currentValue });
}
