import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { routineToClient, type RoutineRow } from "@/lib/agents/routines-server";

export const dynamic = "force-dynamic";

const FREQUENCIES = new Set(["daily", "weekly", "monthly", "quarterly", "yearly"]);
const TIME_RE = /^\d{2}:\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RoutineInput = {
  id?: string;
  agentKey?: string;
  label?: string;
  prompt?: string;
  frequency?: string;
  time?: string;
  active?: boolean;
  createdAt?: number;
  lastRunAt?: number | null;
  lastError?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(input: RoutineInput, orgId: string, userId: string, timezone: string): any {
  return {
    ...(input.id && UUID_RE.test(input.id) ? { id: input.id } : {}),
    organization_id: orgId,
    created_by: userId,
    agent_key: String(input.agentKey ?? "").slice(0, 80),
    label: String(input.label ?? "").slice(0, 200),
    prompt: String(input.prompt ?? "").slice(0, 4000),
    frequency: FREQUENCIES.has(String(input.frequency)) ? String(input.frequency) : "daily",
    time_of_day: TIME_RE.test(String(input.time)) ? String(input.time) : "09:00",
    timezone,
    active: input.active !== false,
    ...(typeof input.createdAt === "number" ? { created_at: new Date(input.createdAt).toISOString() } : {}),
    ...(typeof input.lastRunAt === "number" ? { last_run_at: new Date(input.lastRunAt).toISOString() } : {}),
    ...(typeof input.lastError === "string" ? { last_error: input.lastError.slice(0, 500) } : {}),
  };
}

/** Liste les routines de l'org (option ?agent_key=). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const agentKey = new URL(request.url).searchParams.get("agent_key");
  let q = supabase
    .from("agent_routines")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (agentKey) q = q.eq("agent_key", agentKey);
  const { data, error } = await q;
  // Migration non appliquée → liste vide (le client retombe sur le localStorage).
  if (error) return NextResponse.json({ routines: [], unavailable: true });
  return NextResponse.json({ routines: ((data ?? []) as RoutineRow[]).map(routineToClient) });
}

/**
 * Crée une routine — ou importe en masse l'existant localStorage
 * (body { import: Routine[] }, une seule fois par navigateur).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: RoutineInput & { import?: RoutineInput[]; timezone?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const timezone = typeof body.timezone === "string" && body.timezone ? body.timezone.slice(0, 60) : "Europe/Paris";

  // ── Import en masse (migration localStorage → base) ──
  if (Array.isArray(body.import)) {
    const items = body.import.filter((r) => r?.agentKey && r?.label && r?.prompt).slice(0, 100);
    if (items.length === 0) return NextResponse.json({ imported: 0 });
    // Idempotent : on n'importe pas une routine déjà présente (même agent + libellé).
    const { data: existing } = await supabase
      .from("agent_routines")
      .select("agent_key, label")
      .eq("organization_id", orgId);
    const seen = new Set((existing ?? []).map((r) => `${r.agent_key}::${r.label}`));
    const rows = items
      .filter((r) => !seen.has(`${r.agentKey}::${String(r.label).slice(0, 200)}`))
      .map((r) => toRow(r, orgId, user.id, timezone));
    if (rows.length === 0) return NextResponse.json({ imported: 0 });
    const { error } = await supabase.from("agent_routines").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ imported: rows.length });
  }

  // ── Création unitaire ──
  if (!body.agentKey || !body.label?.trim() || !body.prompt?.trim()) {
    return NextResponse.json({ error: "agentKey, label et prompt requis" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("agent_routines")
    .insert(toRow(body, orgId, user.id, timezone))
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routine: routineToClient(data as RoutineRow) });
}
