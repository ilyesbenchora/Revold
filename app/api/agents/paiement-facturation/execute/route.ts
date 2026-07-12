import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import type { ProposedAction } from "@/lib/ai/agents/agent-runtime";

/**
 * Exécute une action proposée par l'agent APRÈS confirmation explicite de
 * l'utilisateur (human-in-the-loop). Pour le POC : create_alert → insert dans
 * la table `alerts` (RLS org-scoped via le client serveur authentifié).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });
  }

  let action: ProposedAction;
  try {
    action = ((await request.json()) as { action: ProposedAction }).action;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  if (!action || action.action_type !== "create_alert") {
    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  }

  const allowedCategories = new Set(["finance", "sales", "revops", "marketing", "csm"]);
  const category = allowedCategories.has(action.category ?? "") ? action.category! : "finance";

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
    console.error("[agent:paiement-facturation] execute failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
