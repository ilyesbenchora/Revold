import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import type { ProposedAction } from "@/lib/ai/agents/agent-runtime";
import { getAgent } from "@/lib/ai/agents/registry";
import { insertAlertResilient } from "@/lib/alerts/resilient";

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

  let body: {
    action: ProposedAction;
    threshold?: number | null;
    unit_mode?: string;
    date_from?: string | null;
    date_to?: string | null;
    cross_sources?: string[] | null;
    threshold_secondary?: number | null;
    unit_mode_secondary?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const action = body.action;
  if (!action || action.action_type !== "create_alert") {
    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  }

  const allowed = new Set(["finance", "sales", "revops", "marketing", "csm"]);
  const category = allowed.has(action.category ?? "") ? action.category! : "revops";
  const normUnit = (v: unknown) => (v === "count" ? "count" : v === "currency" ? "currency" : v === "percent" ? "percent" : null);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const crossSources = Array.isArray(body.cross_sources)
    ? body.cross_sources.filter((s) => typeof s === "string").slice(0, 12)
    : null;
  const row = {
    organization_id: orgId,
    agent_key: agentKey,
    title: action.title.slice(0, 200),
    description: action.description || action.title,
    impact: action.impact || "Impact à préciser",
    category,
    status: "active",
    threshold: typeof body.threshold === "number" && Number.isFinite(body.threshold) ? body.threshold : null,
    unit_mode: normUnit(body.unit_mode),
    date_from: body.date_from && dateRe.test(body.date_from) ? body.date_from : null,
    date_to: body.date_to && dateRe.test(body.date_to) ? body.date_to : null,
    cross_sources: crossSources && crossSources.length ? crossSources : null,
    threshold_secondary:
      typeof body.threshold_secondary === "number" && Number.isFinite(body.threshold_secondary)
        ? body.threshold_secondary
        : null,
    unit_mode_secondary: normUnit(body.unit_mode_secondary),
  };

  // Insert résilient : retire agent_key / cross_sources / *_secondary si la
  // colonne n'existe pas encore (migration non appliquée).
  const { id, error } = await insertAlertResilient(supabase, row);
  if (error) {
    console.error(`[agent:${agentKey}] execute failed`, error);
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
