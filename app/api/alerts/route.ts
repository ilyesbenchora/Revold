import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveKpiValue, getDefaultDirection } from "@/lib/alerts/kpi-resolver";

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
    // Marketing filters
    lifecycle_stage, source_filters, custom_property, custom_prop_value,
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

  const { data, error } = await supabase.from("alerts").insert({
    organization_id: profile.organization_id,
    created_by: user.id,
    title,
    description,
    impact,
    category: category || "sales",
    status: "active",
    forecast_type: forecast_type || null,
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
    frequency: frequency || "every_check",
    expires_at: expires_at || null,
    min_deal_amount: min_deal_amount != null ? Number(min_deal_amount) : null,
    deal_stage_filter: deal_stage_filter || null,
    lifecycle_stage: lifecycle_stage || null,
    source_filters: source_filters?.length ? source_filters : null,
    custom_property: custom_property || null,
    custom_prop_value: custom_prop_value || null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id, current_value: currentValue });
}
