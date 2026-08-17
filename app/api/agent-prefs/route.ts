import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getAgent } from "@/lib/ai/agents/registry";
import { AGENT_TONES } from "@/lib/ai/agents/agent-prefs";

export const dynamic = "force-dynamic";

/** Enregistre (upsert) les préférences d'un agent : ton, personnalité, insights. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { agent_key?: string; tone?: string | null; personality?: string | null; insights_enabled?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const agentKey = typeof body.agent_key === "string" ? body.agent_key.trim() : "";
  if (!agentKey || !getAgent(agentKey)) return NextResponse.json({ error: "Agent inconnu" }, { status: 400 });

  const tone = typeof body.tone === "string" && AGENT_TONES.some((t) => t.id === body.tone) ? body.tone : null;
  const personality = typeof body.personality === "string" ? body.personality.trim().slice(0, 1200) || null : null;
  const insightsEnabled = body.insights_enabled === true;

  // Upsert manuel (unique organization_id + agent_key).
  const { data: existing, error: readErr } = await supabase
    .from("agent_prefs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("agent_key", agentKey)
    .maybeSingle();
  if (readErr && /agent_prefs/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260817000001_agent_prefs non appliquée (table agent_prefs absente)." },
      { status: 500 },
    );
  }
  const row = { tone, personality, insights_enabled: insightsEnabled, updated_by: user.id, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("agent_prefs").update(row).eq("id", existing.id)
    : await supabase.from("agent_prefs").insert({ organization_id: orgId, agent_key: agentKey, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
