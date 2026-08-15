import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  savedReportToClient,
  savedReportToRow,
  type SavedReportInput,
  type SavedReportRow,
} from "@/lib/agents/saved-reports-server";

export const dynamic = "force-dynamic";

/** Liste les rapports enregistrés de l'org (option ?agent_key=). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const agentKey = new URL(request.url).searchParams.get("agent_key");
  let q = supabase
    .from("saved_reports")
    .select("*")
    .eq("organization_id", orgId)
    .order("saved_at", { ascending: false })
    .limit(300);
  if (agentKey) q = q.eq("agent_key", agentKey);
  const { data, error } = await q;
  // Migration non appliquée → liste vide (le client retombe sur le localStorage).
  if (error) return NextResponse.json({ reports: [], unavailable: true });
  return NextResponse.json({ reports: ((data ?? []) as SavedReportRow[]).map(savedReportToClient) });
}

/**
 * Enregistre un rapport — ou importe en masse l'existant localStorage
 * (body { import: SavedReport[] }, une seule fois par navigateur).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: SavedReportInput & { import?: SavedReportInput[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  // ── Import en masse (migration localStorage → base) ──
  if (Array.isArray(body.import)) {
    const items = body.import.filter((r) => r?.agentKey && r?.title).slice(0, 200);
    if (items.length === 0) return NextResponse.json({ imported: 0 });
    // Idempotent : pas de doublon (même agent + titre + horodatage).
    const { data: existing } = await supabase
      .from("saved_reports")
      .select("agent_key, title, saved_at")
      .eq("organization_id", orgId);
    const seen = new Set(
      (existing ?? []).map((r) => `${r.agent_key}::${r.title}::${r.saved_at ? Date.parse(r.saved_at) : 0}`),
    );
    const rows = items
      .filter((r) => !seen.has(`${r.agentKey}::${String(r.title).slice(0, 300)}::${typeof r.savedAt === "number" ? r.savedAt : 0}`))
      .map((r) => savedReportToRow(r, orgId, user.id));
    if (rows.length === 0) return NextResponse.json({ imported: 0 });
    const { error } = await supabase.from("saved_reports").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ imported: rows.length });
  }

  // ── Création unitaire ──
  if (!body.agentKey || !body.title) {
    return NextResponse.json({ error: "agentKey et title requis" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("saved_reports")
    .insert(savedReportToRow(body, orgId, user.id))
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: savedReportToClient(data as SavedReportRow) });
}
