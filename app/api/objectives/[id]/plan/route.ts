import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { runAgentTurn } from "@/lib/ai/agents/agent-runtime";
import { getAgent, buildSystemPrompt } from "@/lib/ai/agents/registry";
import { getActiveMcpServers } from "@/lib/mcp/servers";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

export const maxDuration = 60;

const AGENT_FOR: Record<string, string> = {
  finance: "paiement-facturation", csm: "service-client",
  sales: "performance", commercial: "performance", revops: "performance", marketing: "performance",
};
function unitStr(u: string | null): string {
  return u === "count" ? "" : u === "currency" ? " €" : " %";
}

/**
 * Génère un PLAN IA pour atteindre un objectif : diagnostic chiffré de l'écart
 * (vrais chiffres via les outils) + leviers + analyses + actions. Human-in-the-loop
 * pour les actions (l'agent propose, l'utilisateur exécute depuis le chat).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { key: anthropicKey } = getAnthropicKey();
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data: o } = await supabase
    .from("objectives")
    .select("title, category, forecast_type, target, unit_mode, direction, current_value, date_from, date_to")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!o) return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });

  const agentKey = AGENT_FOR[(o.category as string) ?? ""] ?? "performance";
  const agent = getAgent(agentKey);
  if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 500 });

  // Valeur actuelle réelle.
  let current: number | null = typeof o.current_value === "number" ? o.current_value : null;
  if (o.forecast_type) {
    try {
      const v = await resolveKpiValue(supabase, orgId, o.forecast_type as string, {
        date_from: o.date_from as string | null,
        date_to: o.date_to as string | null,
      });
      if (typeof v === "number") current = v;
    } catch {
      /* garde la valeur manuelle */
    }
  }

  const unit = unitStr(o.unit_mode as string | null);
  const target = o.target as number | null;
  const gap = target != null && current != null ? target - current : null;
  const daysLeft = o.date_to ? Math.ceil((new Date(`${o.date_to}T23:59:59`).getTime() - Date.now()) / 86_400_000) : null;

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const mcpServers = await getActiveMcpServers(supabase, orgId);
  const client = new Anthropic({ apiKey: anthropicKey });
  const system = buildSystemPrompt(agent);

  const prompt =
    `OBJECTIF À ATTEINDRE : « ${o.title} ».\n` +
    `Cible : ${target ?? "?"}${unit} (sens : ${o.direction === "below" ? "descendre sous" : "atteindre"}).\n` +
    `Valeur actuelle : ${current ?? "inconnue"}${unit}.` +
    (gap != null ? ` Écart à combler : ${Math.round(gap)}${unit}.` : "") +
    (daysLeft != null ? ` Échéance : ${o.date_to} (${daysLeft} jours restants).` : "") +
    `\n\nProduis un PLAN concret et priorisé pour atteindre cet objectif d'ici l'échéance, en t'appuyant sur les VRAIS chiffres (utilise tes outils) :\n` +
    `1) Diagnostic chiffré de l'écart et de sa cause racine.\n` +
    `2) Les 2-3 leviers à plus fort impact, chacun avec l'impact estimé en ${o.unit_mode === "currency" ? "€" : o.unit_mode === "percent" ? "points" : "volume"}.\n` +
    `3) Les analyses/rapports précis à lancer pour piloter.\n` +
    `4) Les actions concrètes à mener (relances, corrections…).\n` +
    `Texte bref, dense, actionnable. Pas de graphique ni de rapport figé ici — juste le plan.`;

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: agent.tools,
      messages: [{ role: "user", content: prompt }],
      ctx: { supabase, orgId, hubspotToken, sources: [] },
      mcpServers,
      maxSteps: 6,
    });
    return NextResponse.json({ plan: result.text, agentKey });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }
}
