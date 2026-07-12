import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Runtime générique d'agent conversationnel + agentique pour Revold.
 *
 * Pattern : agent-orchestrateur au-dessus de la couche déterministe.
 * L'agent NE recalcule PAS la donnée — il APPELLE les fetchers/KPIs existants
 * en tool-calling (function calling). Chaque section (Paiement & Facturation,
 * Performance, Service Client…) fournit son system prompt + son jeu de tools
 * et réutilise ce runtime.
 *
 * Human-in-the-loop : les tools "action" (sans `run`) ne sont PAS exécutés
 * côté serveur. Ils sont capturés comme `proposedAction` et renvoyés à l'UI
 * pour confirmation explicite avant toute écriture.
 */

export const AGENT_MODEL = "claude-opus-4-8";

/** Contexte injecté dans chaque exécution de tool côté serveur. */
export type AgentContext = {
  supabase: SupabaseClient;
  orgId: string;
  hubspotToken: string | null;
  /** Clés des sources sélectionnées par l'utilisateur (ex: ["stripe","hubspot"]). */
  sources: string[];
};

/** Un tool exposé à l'agent. */
export type AgentTool = {
  def: Anthropic.Tool;
  /**
   * Exécuteur côté serveur. Si absent, le tool est "confirmable" : son input
   * est capturé comme action proposée et renvoyé à l'UI (aucune écriture).
   */
  run?: (input: Record<string, unknown>, ctx: AgentContext) => Promise<unknown>;
};

/** Action proposée par l'agent, en attente de confirmation utilisateur. */
export type ProposedAction = {
  action_type: string;
  title: string;
  description: string;
  category?: string;
  impact?: string;
};

/** Trace d'un appel de tool, pour affichage "l'agent a fait X". */
export type ToolTraceEntry = {
  name: string;
  input: Record<string, unknown>;
};

export type AgentTurnResult = {
  text: string;
  proposedAction: ProposedAction | null;
  toolTrace: ToolTraceEntry[];
};

export type AgentMessage = { role: "user" | "assistant"; content: string };

/**
 * Nom réservé du tool d'action confirmable. Quand l'agent l'appelle, on capture
 * l'input comme `proposedAction` sans l'exécuter, puis on laisse l'agent conclure.
 */
export const PROPOSE_ACTION_TOOL = "propose_action";

/**
 * Joue un tour d'agent : boucle tool-use jusqu'à `end_turn` (ou `maxSteps`).
 * Renvoie le texte final, l'éventuelle action proposée et la trace des tools.
 */
export async function runAgentTurn(opts: {
  client: Anthropic;
  system: string;
  tools: AgentTool[];
  messages: AgentMessage[];
  ctx: AgentContext;
  maxSteps?: number;
}): Promise<AgentTurnResult> {
  const { client, system, tools, messages, ctx } = opts;
  const maxSteps = opts.maxSteps ?? 6;

  const toolDefs = tools.map((t) => t.def);
  const byName = new Map(tools.map((t) => [t.def.name, t]));

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolTrace: ToolTraceEntry[] = [];
  let proposedAction: ProposedAction | null = null;

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system,
      tools: toolDefs,
      messages: convo,
    });

    if (res.stop_reason !== "tool_use") {
      return { text: extractText(res.content), proposedAction, toolTrace };
    }

    // On rejoue le tour assistant (blocs tool_use inclus) avant de répondre.
    // Les blocs de réponse (ContentBlock) sont acceptés en entrée par l'API.
    convo.push({
      role: "assistant",
      content: res.content as unknown as Anthropic.ContentBlockParam[],
    });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      toolTrace.push({ name: block.name, input });

      // Tool d'action confirmable → capturé, PAS exécuté.
      if (block.name === PROPOSE_ACTION_TOOL) {
        proposedAction = normalizeProposedAction(input);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content:
            "Action proposée et affichée à l'utilisateur pour confirmation. " +
            "Ne pas la considérer comme exécutée. Conclus en une phrase.",
        });
        continue;
      }

      const tool = byName.get(block.name);
      if (!tool?.run) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Tool inconnu: ${block.name}`,
          is_error: true,
        });
        continue;
      }

      try {
        const out = await tool.run(input, ctx);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(out),
        });
      } catch (err) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Erreur lors de l'exécution: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }

    convo.push({ role: "user", content: results });
  }

  // Budget de tours épuisé → un dernier appel SANS tools pour forcer une synthèse.
  const final = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2048,
    system,
    messages: [
      ...convo,
      {
        role: "user",
        content:
          "Tu as atteint la limite d'étapes. Synthétise maintenant ta réponse " +
          "avec les données déjà récupérées, sans appeler d'autre outil.",
      },
    ],
  });

  return { text: extractText(final.content), proposedAction, toolTrace };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function normalizeProposedAction(input: Record<string, unknown>): ProposedAction {
  const str = (v: unknown, fallback = "") =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  return {
    action_type: str(input.action_type, "create_alert"),
    title: str(input.title, "Action Revold"),
    description: str(input.description),
    category: str(input.category, "finance"),
    impact: str(input.impact),
  };
}
