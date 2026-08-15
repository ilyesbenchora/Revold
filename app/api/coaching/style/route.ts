import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { normalizeStyle, DEFAULT_COACHING_STYLE } from "@/lib/coaching/style";

export const dynamic = "force-dynamic";

/**
 * Style de coaching d'un coach (Paramètres du coach) : ton, niveau de
 * challenge, format de séance, consignes libres. Stocké par organisation et
 * par coach, injecté dans le system prompt à chaque séance.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const agentKey = new URL(request.url).searchParams.get("agent_key") ?? "";
  if (!agentKey) return NextResponse.json({ error: "agent_key requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("coaching_styles")
    .select("tone, challenge, format, custom_instructions")
    .eq("organization_id", orgId)
    .eq("agent_key", agentKey)
    .maybeSingle();
  // Table absente (migration non appliquée) → style par défaut, jamais d'erreur.
  if (error || !data) return NextResponse.json({ style: DEFAULT_COACHING_STYLE });
  return NextResponse.json({
    style: normalizeStyle({
      tone: data.tone,
      challenge: data.challenge,
      format: data.format,
      customInstructions: data.custom_instructions,
    }),
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { agent_key?: string; style?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const agentKey = typeof body.agent_key === "string" ? body.agent_key.slice(0, 80) : "";
  if (!agentKey) return NextResponse.json({ error: "agent_key requis" }, { status: 400 });
  const style = normalizeStyle(body.style);

  const { error } = await supabase.from("coaching_styles").upsert(
    {
      organization_id: orgId,
      agent_key: agentKey,
      tone: style.tone,
      challenge: style.challenge,
      format: style.format,
      custom_instructions: style.customInstructions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,agent_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, style });
}
