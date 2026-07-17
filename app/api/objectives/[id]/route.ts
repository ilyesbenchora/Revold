import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** PATCH /api/objectives/[id] — modifie un objectif. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === "string") patch.title = b.title.slice(0, 200);
  if (typeof b.description === "string") patch.description = b.description.slice(0, 2000);
  if (typeof b.impact === "string") patch.impact = b.impact.slice(0, 2000);
  if (b.target === null || typeof b.target === "number") patch.target = b.target;
  if (b.current_value === null || typeof b.current_value === "number") patch.current_value = b.current_value;
  if (b.unit_mode === "percent" || b.unit_mode === "count" || b.unit_mode === "currency") patch.unit_mode = b.unit_mode;
  if (b.direction === "above" || b.direction === "below") patch.direction = b.direction;
  if (typeof b.forecast_type === "string" || b.forecast_type === null) patch.forecast_type = b.forecast_type;
  if (b.date_from === null || (typeof b.date_from === "string" && dateRe.test(b.date_from))) patch.date_from = b.date_from;
  if (b.date_to === null || (typeof b.date_to === "string" && dateRe.test(b.date_to))) patch.date_to = b.date_to;
  if (b.status === "active" || b.status === "archived") patch.status = b.status;

  const { error } = await supabase.from("objectives").update(patch).eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/objectives/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase.from("objectives").delete().eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
