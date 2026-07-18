import Anthropic from "@anthropic-ai/sdk";
import { computeAggregate, type AggregateSpec } from "@/lib/ai/agents/tool-library";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { PAGE_AGENT_KEY } from "@/lib/reports/data-table-presets";

// Catalogue canonique disponible (même contrat que aggregate_canonical) : garantit
// que l'agent ne peut produire qu'une table 100 % calculable et fiable.
const CANONICAL_DOC =
  "deals: dimensions month_created, month_closed, stage — mesures count, ou sum/avg du champ amount. " +
  "invoices: dimensions status, source, month_issued, month_paid — mesures count, ou sum/avg des champs amount_total, amount_paid, amount_due. " +
  "subscriptions: dimensions status, source, month_started, month_canceled — mesures count, ou sum/avg du champ mrr. " +
  "tickets: dimension status — mesure count. " +
  "companies: dimensions segment, industry, country — mesure count. " +
  "contacts: dimensions mql, sql — mesure count.";

const BUILD_TOOL: Anthropic.Tool = {
  name: "build_data_table",
  description:
    "Construit une table de données FIABLE répondant au KPI personnalisé de l'utilisateur, " +
    "en utilisant UNIQUEMENT les entités/dimensions/champs canoniques disponibles. " +
    "Choisis la combinaison la plus proche du besoin. Ne jamais inventer une entité, dimension ou champ.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titre court et clair de la table (max ~6 mots)." },
      entity: { type: "string", enum: ["deals", "invoices", "subscriptions", "tickets", "companies", "contacts"] },
      groupBy: { type: "string", description: "Dimension de regroupement (voir la liste par entité)." },
      measure: { type: "string", enum: ["count", "sum", "avg"] },
      field: { type: "string", description: "Champ numérique pour sum/avg (amount, amount_total, amount_paid, amount_due, mrr). Vide si count." },
      unit_mode: { type: "string", enum: ["count", "currency", "percent"], description: "count si comptage, currency si montant en €." },
    },
    required: ["title", "entity", "groupBy", "measure"],
  },
};

export type ResolvedKpi =
  | { ok: true; spec: AggregateSpec; unitMode: string; agentTitle: string | null; agentName: string }
  | { ok: false; error: string; status: number };

/**
 * Fait interpréter un KPI décrit en langage naturel par l'agent de la page vers
 * une spec agrégée canonique, PUIS la valide en déterministe (rejet si non
 * calculable). Réutilisé à la création ET à l'édition d'une table de données.
 */
export async function resolveCustomKpiSpec(
  supabase: Parameters<typeof computeAggregate>[0],
  orgId: string,
  hubspotToken: string | null,
  pageKey: string,
  kpi: string,
): Promise<ResolvedKpi> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const persona = getAgentPersona(PAGE_AGENT_KEY[pageKey]);
  if (!anthropicKey) return { ok: false, error: "ANTHROPIC_API_KEY not configured", status: 500 };

  const client = new Anthropic({ apiKey: anthropicKey });
  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
    `Tu construis une table de données à partir du KPI décrit par l'utilisateur. ` +
    `IMPÉRATIF DE FIABILITÉ : n'utilise QUE ce catalogue canonique — ${CANONICAL_DOC} ` +
    `Traduis le besoin vers la combinaison entité/dimension/mesure/champ la plus proche et 100 % calculable. ` +
    `Si le besoin implique un montant en euros, mets unit_mode=currency ; sinon count. ` +
    `Pour le titre : REPRENDS fidèlement le KPI écrit par l'utilisateur, en le peaufinant seulement si besoin ` +
    `(orthographe, concision) — ne change pas son sens ni son intention. Réponds uniquement via l'outil.`;

  let spec: AggregateSpec;
  let unitMode = "count";
  let agentTitle: string | null = null;
  try {
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system,
      tools: [BUILD_TOOL],
      tool_choice: { type: "tool", name: "build_data_table" },
      messages: [{ role: "user", content: `KPI personnalisé demandé : « ${kpi} ». Construis la table correspondante.` }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return { ok: false, error: "L'agent n'a pas pu interpréter ce KPI.", status: 422 };
    const inp = toolUse.input as {
      title?: string; entity?: string; groupBy?: string; measure?: string; field?: string; unit_mode?: string;
    };
    agentTitle = inp.title?.trim() || null;
    unitMode = inp.unit_mode === "currency" ? "currency" : inp.unit_mode === "percent" ? "percent" : "count";
    spec = {
      entity: String(inp.entity ?? ""),
      groupBy: String(inp.groupBy ?? ""),
      measure: inp.measure ?? "count",
      field: inp.field ? String(inp.field) : null,
      date_from: null,
      date_to: null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur agent", status: 500 };
  }

  // Validation déterministe : on rejette toute spec non calculable (fiabilité).
  const check = await computeAggregate(supabase, orgId, [], hubspotToken, spec);
  if (check.error) {
    return {
      ok: false,
      error: `L'agent n'a pas trouvé de donnée fiable pour « ${kpi} ». Reformule ou choisis un KPI proposé.`,
      status: 422,
    };
  }

  return { ok: true, spec, unitMode, agentTitle, agentName: persona.name };
}
