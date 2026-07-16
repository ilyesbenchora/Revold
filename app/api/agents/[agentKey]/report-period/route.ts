import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { runAgentTurn } from "@/lib/ai/agents/agent-runtime";
import { getAgent, buildSystemPrompt } from "@/lib/ai/agents/registry";
import { getActiveMcpServers } from "@/lib/mcp/servers";

export const maxDuration = 60;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Régénère un rapport/graphique pour une PÉRIODE donnée, avec les VRAIS chiffres
 * (recalcul via les outils déterministes de l'agent, date_from/date_to). Fiable :
 * aucune donnée inventée, pas de découpage approximatif côté client.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const agent = getAgent(agentKey);
  if (!agent) return NextResponse.json({ error: `Agent inconnu: ${agentKey}` }, { status: 404 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    kind?: "chart" | "report";
    title?: string;
    summary?: string;
    dimensions?: string[];
    from?: string;
    to?: string;
    periodLabel?: string;
    sources?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const from = body.from && dateRe.test(body.from) ? body.from : "";
  const to = body.to && dateRe.test(body.to) ? body.to : "";
  if (!from || !to) return NextResponse.json({ error: "Période invalide (from/to requis)" }, { status: 400 });

  const kind = body.kind === "report" ? "report" : "chart";
  const title = (body.title ?? "Rapport").slice(0, 200);
  const dims = Array.isArray(body.dimensions) ? body.dimensions.filter((d) => typeof d === "string").slice(0, 40) : [];
  const sources = Array.isArray(body.sources) ? body.sources.filter((s) => typeof s === "string") : [];

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const client = new Anthropic({ apiKey: anthropicKey });
  const mcpServers = await getActiveMcpServers(supabase, orgId);

  const system =
    buildSystemPrompt(agent) +
    `\n\nSources sélectionnées : ${sources.length ? sources.join(", ") : "source par défaut"}.`;

  const toolName = kind === "chart" ? "propose_chart" : "render_report";
  const prompt =
    `Régénère EXACTEMENT ce rapport pour la période « ${body.periodLabel ?? `${from} → ${to}`} » (du ${from} au ${to}).\n` +
    `Titre du rapport : ${title}.\n` +
    (body.summary ? `Résumé initial : ${body.summary}\n` : "") +
    (dims.length ? `Dimension attendue (mêmes catégories/axe) : ${dims.join(", ")}.\n` : "") +
    `Impératif de FIABILITÉ : utilise TES OUTILS avec date_from=${from} et date_to=${to} pour récupérer les VRAIS chiffres de cette période. ` +
    `Aucune donnée inventée, estimée ou extrapolée. Garde la même métrique et la même dimension qu'au départ. ` +
    `Si la donnée manque pour cette période, renvoie un rapport avec des valeurs à 0 plutôt que d'inventer.\n` +
    `Réponds UNIQUEMENT en appelant ${toolName} avec les données réelles de la période. Ne pose aucune question, n'ajoute pas d'alerte.`;

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: agent.tools,
      messages: [{ role: "user", content: prompt }],
      ctx: { supabase, orgId, hubspotToken, sources },
      mcpServers,
      maxSteps: 6,
    });
    return NextResponse.json({
      report: result.report,
      chartProposal: result.chartProposal,
    });
  } catch (err) {
    console.error(`[agent:${agentKey}] report-period failed`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }
}
