import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { runAgentTurn, type AgentMessage } from "@/lib/ai/agents/agent-runtime";
import { getAgent, buildSystemPrompt, coachingDirective } from "@/lib/ai/agents/registry";
import { getCoachingMemory, memoryDirective } from "@/lib/coaching/session-memory";
import { getAgentPrefs, prefsDirective } from "@/lib/ai/agents/agent-prefs";
import { metricDictionaryDirective } from "@/lib/settings/metric-definitions";
import { sanitizeAttachments, attachmentsSystemBlock } from "@/lib/attachments";
import { getActiveMcpServers } from "@/lib/mcp/servers";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

// 300 s (comme les crons) : un rapport complet de routine (KPIs + graphique +
// table, plusieurs appels d'outils) dépasse facilement 60 s — au-delà, Vercel
// coupait la fonction et renvoyait une page d'erreur texte (« An error o… »).
export const maxDuration = 300;

type Body = {
  messages?: AgentMessage[];
  sources?: string[];
  coaching?: { objectives?: string; pains?: string } | null;
  attachments?: unknown;
};

export async function POST(request: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const agent = getAgent(agentKey);
  if (!agent) {
    return NextResponse.json({ error: `Agent inconnu: ${agentKey}` }, { status: 404 });
  }

  const { key: anthropicKey } = getAnthropicKey();
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

  let system =
    buildSystemPrompt(agent) +
    `\n\nSources sélectionnées pour cette conversation : ${sources.length ? sources.join(", ") : "aucune sélection explicite (utilise la source configurée par défaut)"}.`;

  // Préférences de l'UTILISATEUR pour cet agent (Paramètres → Agents) :
  // ton + personnalité injectés dans le system prompt — propres à chacun.
  const prefDir = prefsDirective(await getAgentPrefs(supabase, orgId, user.id, agentKey));
  if (prefDir) system += prefDir;

  // Dictionnaire des métriques de l'org (Paramètres → Métriques) : les
  // définitions MAISON font foi quand l'utilisateur emploie ces termes.
  system += await metricDictionaryDirective(supabase, orgId);

  // Outils SUR MESURE de l'org (ERP maison, logiciel métier) : sans leur
  // description, « custom_gaia » n'est qu'un nom vide pour l'agent. Avec elle,
  // il interprète correctement la nature des enregistrements.
  try {
    const { data: customTools } = await supabase
      .from("custom_connectors")
      .select("key, label, description")
      .eq("organization_id", orgId)
      .eq("is_active", true);
    const described = (customTools ?? []).filter((t) => t.description);
    if (described.length > 0) {
      system +=
        `\n\nOUTILS SUR MESURE de cette organisation (données déjà intégrées au modèle canonique, source = custom_<clé>) :\n` +
        described.map((t) => `- custom_${t.key} (${t.label}) : ${t.description}`).join("\n") +
        `\nTiens compte de ce contexte métier quand tu analyses des données issues de ces sources.`;
    }
  } catch {
    /* table absente → contexte simplement omis */
  }

  // Séance cadrée : objectifs/pains fournis par le formulaire en amont.
  if (body.coaching && (body.coaching.objectives || body.coaching.pains)) {
    system += coachingDirective(body.coaching.objectives ?? "", body.coaching.pains ?? "");
  }

  // Mémoire de séance, style et plan de développement — disponibles pour TOUS
  // les agents : c'est la mécanique d'accompagnement dans la durée qui a de la
  // valeur, pas une famille d'agents dédiée. Clé de stockage = clé de l'agent.
  {
    const coachCategory = agentKey;
    if (coachCategory) {
      const memory = await getCoachingMemory(supabase, orgId, coachCategory);
      system += memoryDirective(memory);

      // Style choisi par l'utilisateur (ton, challenge, format) — il prime sur
      // le style par défaut du prompt de base.
      try {
        const { data: styleRow } = await supabase
          .from("coaching_styles")
          .select("tone, challenge, format, custom_instructions")
          .eq("organization_id", orgId)
          .eq("agent_key", agentKey)
          .maybeSingle();
        if (styleRow) {
          const { normalizeStyle, styleDirective } = await import("@/lib/coaching/style");
          system += `\n\n${styleDirective(
            normalizeStyle({
              tone: styleRow.tone,
              challenge: styleRow.challenge,
              format: styleRow.format,
              customInstructions: styleRow.custom_instructions,
            }),
          )}`;
        }
      } catch {
        /* table absente → style par défaut */
      }

      // Plan de développement en cours : le fil rouge de la séance, avec sa
      // preuve business (objectif témoin) — le coach confronte le déclaratif
      // aux vraies données au lieu de féliciter à l'aveugle.
      try {
        const { loadDevelopmentPlans, planDirective } = await import("@/lib/coaching/development");
        const plans = await loadDevelopmentPlans(supabase, orgId, coachCategory);
        system += `\n\n${planDirective(plans)}`;
      } catch {
        /* tables absentes → coaching classique */
      }
    }
  }

  // Fichiers joints (Excel / CSV / Google Sheets) → contexte pour l'agent.
  const attachments = sanitizeAttachments(body.attachments);
  if (attachments.length) {
    system += attachmentsSystemBlock(attachments);
  }

  // Serveurs MCP connectés (POC) — exposés à l'agent en plus des fetchers.
  const mcpServers = await getActiveMcpServers(supabase, orgId);

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: agent.tools,
      messages,
      ctx: { supabase, orgId, hubspotToken, sources },
      mcpServers,
    });
    return NextResponse.json({
      message: result.text,
      proposedAction: result.proposedAction,
      report: result.report,
      chartProposal: result.chartProposal,
      dealAction: result.dealAction,
      redirect: result.redirect,
      toolTrace: result.toolTrace.map((t) => t.name),
    });
  } catch (err) {
    console.error(`[agent:${agentKey}] turn failed`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }
}
