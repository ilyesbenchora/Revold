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
  const { title, description, impact, category, forecast_type, threshold, direction } = body;

  if (!title || !description || !impact) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // If forecast_type is provided, compute the current KPI value immediately
  let currentValue: number | null = null;
  if (forecast_type && threshold != null) {
    currentValue = await resolveKpiValue(supabase, profile.organization_id, forecast_type);
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
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id, current_value: currentValue });
}
