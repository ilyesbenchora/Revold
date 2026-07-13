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

/** Bloc d'un rapport rendu par l'UI (KPI, graphique, table). */
export type ReportBlock = {
  type: "kpi" | "bar" | "line" | "area" | "donut" | "table";
  title?: string;
  label?: string;
  value?: string;
  hint?: string;
  data?: { name: string; value: number }[];
  columns?: string[];
  rows?: string[][];
};

/** Spécification d'un rapport construit par l'agent (Dashboard/Reporting). */
export type ReportSpec = {
  title: string;
  summary?: string;
  blocks: ReportBlock[];
};

/** Proposition de graphique : l'utilisateur choisit le type, l'UI rend la data. */
export type ChartProposal = {
  title: string;
  summary?: string;
  data: { name: string; value: number }[];
  /** Types proposés parmi bar | line | area | donut | table. */
  suggestedTypes: string[];
  defaultType: string;
};

/** Trace d'un appel de tool, pour affichage "l'agent a fait X". */
export type ToolTraceEntry = {
  name: string;
  input: Record<string, unknown>;
};

export type AgentTurnResult = {
  text: string;
  proposedAction: ProposedAction | null;
  report: ReportSpec | null;
  chartProposal: ChartProposal | null;
  toolTrace: ToolTraceEntry[];
};

export type AgentMessage = { role: "user" | "assistant"; content: string };

/**
 * Noms réservés des tools "capturés" : leur input n'est pas exécuté côté
 * serveur mais renvoyé à l'UI (action confirmable, rapport, proposition de graphe).
 */
export const PROPOSE_ACTION_TOOL = "propose_action";
export const RENDER_REPORT_TOOL = "render_report";
export const PROPOSE_CHART_TOOL = "propose_chart";

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
  const maxSteps = opts.maxSteps ?? 8;

  const toolDefs = tools.map((t) => t.def);
  const byName = new Map(tools.map((t) => [t.def.name, t]));

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolTrace: ToolTraceEntry[] = [];
  let proposedAction: ProposedAction | null = null;
  let report: ReportSpec | null = null;
  let chartProposal: ChartProposal | null = null;

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system,
      tools: toolDefs,
      messages: convo,
    });

    if (res.stop_reason !== "tool_use") {
      return { text: extractText(res.content), proposedAction, report, chartProposal, toolTrace };
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

      // Tool de rendu de rapport → capturé, rendu par l'UI (graphiques).
      if (block.name === RENDER_REPORT_TOOL) {
        report = normalizeReport(input);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: report
            ? "Rapport rendu à l'utilisateur (graphiques affichés). Conclus par une courte synthèse des points clés."
            : "Rapport invalide (aucun bloc). Reconstruis-le avec des blocs et des données réelles.",
        });
        continue;
      }

      // Proposition de graphique → capturée ; l'utilisateur choisira le type dans l'UI.
      if (block.name === PROPOSE_CHART_TOOL) {
        chartProposal = normalizeChartProposal(input);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: chartProposal
            ? "Types de graphique proposés à l'utilisateur (il choisira l'icône). Conclus en une phrase, sans re-décrire les chiffres."
            : "Proposition invalide (aucune donnée). Récupère d'abord de vraies données puis repropose.",
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

  return { text: extractText(final.content), proposedAction, report, chartProposal, toolTrace };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function normalizeReport(input: Record<string, unknown>): ReportSpec | null {
  const title = typeof input.title === "string" ? input.title : "Rapport";
  const summary = typeof input.summary === "string" ? input.summary : undefined;
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const allowed = new Set(["kpi", "bar", "line", "area", "donut", "table"]);
  const blocks: ReportBlock[] = [];
  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (typeof o.type !== "string" || !allowed.has(o.type)) continue;
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
    const data = Array.isArray(o.data)
      ? o.data
          .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
          .map((d) => ({ name: String(d.name ?? ""), value: num(d.value) }))
      : undefined;
    const rows = Array.isArray(o.rows)
      ? o.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : [])).filter((r) => r.length > 0)
      : undefined;
    blocks.push({
      type: o.type as ReportBlock["type"],
      title: typeof o.title === "string" ? o.title : undefined,
      label: typeof o.label === "string" ? o.label : undefined,
      value: o.value != null ? String(o.value) : undefined,
      hint: typeof o.hint === "string" ? o.hint : undefined,
      data,
      columns: Array.isArray(o.columns) ? o.columns.map((c) => String(c)) : undefined,
      rows,
    });
  }
  if (blocks.length === 0) return null;
  return { title, summary, blocks };
}

function normalizeChartProposal(input: Record<string, unknown>): ChartProposal | null {
  const title = typeof input.title === "string" ? input.title : "Graphique";
  const summary = typeof input.summary === "string" ? input.summary : undefined;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const data = Array.isArray(input.data)
    ? input.data
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
        .map((d) => ({ name: String(d.name ?? ""), value: num(d.value) }))
    : [];
  if (data.length === 0) return null;
  const allowed = new Set(["bar", "line", "area", "donut", "table"]);
  let suggestedTypes = Array.isArray(input.suggestedTypes)
    ? input.suggestedTypes.map((t) => String(t)).filter((t) => allowed.has(t))
    : [];
  if (suggestedTypes.length === 0) suggestedTypes = ["bar", "line", "donut", "table"];
  const defaultType =
    typeof input.defaultType === "string" && suggestedTypes.includes(input.defaultType)
      ? input.defaultType
      : suggestedTypes[0];
  return { title, summary, data, suggestedTypes, defaultType };
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
