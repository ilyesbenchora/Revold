import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import type { ProposedAction } from "@/lib/ai/agents/agent-runtime";
import { getAgent } from "@/lib/ai/agents/registry";

/**
 * Exécute une action proposée par un agent APRÈS confirmation utilisateur
 * (human-in-the-loop). POC : create_alert → insert dans `alerts` (RLS org-scoped).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  if (!getAgent(agentKey)) {
    return NextResponse.json({ error: `Agent inconnu: ${agentKey}` }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let action: ProposedAction;
  try {
    action = ((await request.json()) as { action: ProposedAction }).action;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  if (!action || action.action_type !== "create_alert") {
    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  }

  const allowed = new Set(["finance", "sales", "revops", "marketing", "csm"]);
  const category = allowed.has(action.category ?? "") ? action.category! : "revops";

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      organization_id: orgId,
      title: action.title.slice(0, 200),
      description: action.description || action.title,
      impact: action.impact || "Impact à préciser",
      category,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[agent:${agentKey}] execute failed`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
