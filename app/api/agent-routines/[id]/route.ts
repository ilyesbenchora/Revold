import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { routineToClient, type RoutineRow } from "@/lib/agents/routines-server";

export const dynamic = "force-dynamic";

const FREQUENCIES = new Set(["daily", "weekly", "monthly", "quarterly", "yearly"]);
const TIME_RE = /^\d{2}:\d{2}$/;

/** Met à jour une routine (fréquence, heure, pause, lastRunAt/lastError…). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    label?: string; prompt?: string; frequency?: string; time?: string; active?: boolean;
    lastRunAt?: number | null; lastError?: string | null;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim().slice(0, 200);
  if (typeof body.prompt === "string" && body.prompt.trim()) patch.prompt = body.prompt.trim().slice(0, 4000);
  if (typeof body.frequency === "string" && FREQUENCIES.has(body.frequency)) patch.frequency = body.frequency;
  if (typeof body.time === "string" && TIME_RE.test(body.time)) patch.time_of_day = body.time;
  if (typeof body.active === "boolean") patch.active = body.active;
  if ("lastRunAt" in body) patch.last_run_at = typeof body.lastRunAt === "number" ? new Date(body.lastRunAt).toISOString() : null;
  if ("lastError" in body) patch.last_error = typeof body.lastError === "string" ? body.lastError.slice(0, 500) : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("agent_routines")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Routine introuvable" }, { status: 404 });
  return NextResponse.json({ routine: routineToClient(data as RoutineRow) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase
    .from("agent_routines")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
