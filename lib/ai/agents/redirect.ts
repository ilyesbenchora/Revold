import type { AgentTool } from "./agent-runtime";

/** Nom réservé du tool de redirection vers un autre agent (capturé, non exécuté). */
export const REDIRECT_TOOL = "redirect_to_agent";

/** Redirection proposée : la demande sort du scope de l'agent courant. */
export type AgentRedirect = { agentKey: string; reason: string };

/**
 * Redirige l'utilisateur vers l'agent pertinent quand la demande sort du scope
 * de l'agent courant. Capturé par le runtime → l'UI affiche un bouton cliquable.
 */
export const redirectToAgentTool: AgentTool = {
  def: {
    name: REDIRECT_TOOL,
    description:
      "À utiliser UNIQUEMENT quand la demande de l'utilisateur sort clairement de TON expertise / scope et relève d'un autre agent Revold. Ne bâcle pas une réponse hors-scope : appelle cet outil avec la clé de l'agent pertinent (agent_key, voir le roster dans ton system prompt) et une raison courte. L'UI proposera à l'utilisateur d'ouvrir le bon agent. Après l'avoir appelé, conclus en une phrase (« C'est plutôt le domaine de … »).",
    input_schema: {
      type: "object",
      properties: {
        agent_key: { type: "string", description: "Clé exacte de l'agent pertinent (ex : performance, paiement-facturation, service-client, prev-revenue…)." },
        reason: { type: "string", description: "Pourquoi cet agent est plus pertinent (une phrase)." },
      },
      required: ["agent_key"],
    },
  },
  // Pas de run → capturé.
};

export function normalizeRedirect(input: Record<string, unknown>): AgentRedirect | null {
  const key = typeof input.agent_key === "string" ? input.agent_key.trim() : "";
  if (!key) return null;
  return { agentKey: key, reason: typeof input.reason === "string" ? input.reason.trim() : "" };
}
