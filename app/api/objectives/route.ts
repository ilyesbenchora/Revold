import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

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

  const row = {
    organization_id: orgId,
    created_by: user.id,
    title: title.slice(0, 200),
    description: typeof b.description === "string" ? b.description.slice(0, 2000) : null,
    impact: typeof b.impact === "string" ? b.impact.slice(0, 2000) : null,
    category: typeof b.category === "string" ? b.category : null,
    team: typeof b.team === "string" ? b.team : null,
    forecast_type: typeof b.forecast_type === "string" && b.forecast_type ? b.forecast_type : null,
    target: typeof b.target === "number" ? b.target : b.target ? Number(b.target) : null,
    unit_mode: unit,
    direction: b.direction === "below" ? "below" : "above",
    current_value: typeof b.current_value === "number" ? b.current_value : b.current_value ? Number(b.current_value) : null,
    date_from: typeof b.date_from === "string" && dateRe.test(b.date_from) ? b.date_from : null,
    date_to: typeof b.date_to === "string" && dateRe.test(b.date_to) ? b.date_to : null,
    status: "active",
  };

  const { data, error } = await supabase.from("objectives").insert(row).select("id").single();
  if (error) {
    if (/objectives/.test(error.message)) return NextResponse.json({ error: "Table objectives absente — applique la migration Supabase." }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
