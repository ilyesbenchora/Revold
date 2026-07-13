import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { runAgentTurn, type AgentMessage } from "@/lib/ai/agents/agent-runtime";
import { getAgent, buildSystemPrompt } from "@/lib/ai/agents/registry";

export const maxDuration = 60;

type Body = { messages?: AgentMessage[]; sources?: string[] };

export async function POST(request: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const agent = getAgent(agentKey);
  if (!agent) {
    return NextResponse.json({ error: `Agent inconnu: ${agentKey}` }, { status: 404 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Le dernier message doit venir de l'utilisateur" }, { status: 400 });
  }

  const sources = Array.isArray(body.sources) ? body.sources.filter((s) => typeof s === "string") : [];
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const client = new Anthropic({ apiKey: anthropicKey });

  const system =
    buildSystemPrompt(agent) +
    `\n\nSources sélectionnées pour cette conversation : ${sources.length ? sources.join(", ") : "aucune sélection explicite (utilise la source configurée par défaut)"}.`;

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: agent.tools,
      messages,
      ctx: { supabase, orgId, hubspotToken, sources },
    });
    return NextResponse.json({
      message: result.text,
      proposedAction: result.proposedAction,
      report: result.report,
      chartProposal: result.chartProposal,
      toolTrace: result.toolTrace.map((t) => t.name),
    });
  } catch (err) {
    console.error(`[agent:${agentKey}] turn failed`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }
}
