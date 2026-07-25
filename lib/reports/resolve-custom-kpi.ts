import Anthropic from "@anthropic-ai/sdk";
import { computeAggregate, type AggregateSpec } from "@/lib/ai/agents/tool-library";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { PAGE_AGENT_KEY } from "@/lib/reports/data-table-presets";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

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
    "À n'utiliser QUE si une combinaison canonique répond FIDÈLEMENT au besoin (matching à 100 %). " +
    "Ne jamais inventer une entité, dimension ou champ, ni approximer un KPI qui n'existe pas dans le catalogue.",
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

/**
 * Échappatoire de l'agent : si AUCUN câblage fiable n'existe, il ne crée PAS de
 * table — il explique pourquoi et donne des instructions concrètes pour
 * reformuler la demande et retrouver le(s) KPI(s) voulus.
 */
const NO_MATCH_TOOL: Anthropic.Tool = {
  name: "no_reliable_match",
  description:
    "À utiliser UNIQUEMENT si aucune combinaison canonique ne répond fidèlement au KPI demandé. " +
    "Aucune table ne sera créée : explique pourquoi, et donne des instructions concrètes et actionnables " +
    "pour modifier la demande (reformulation du KPI, précision de l'entité/dimension/mesure, outil à connecter) " +
    "afin de retrouver le ou les KPIs demandés.",
  input_schema: {
    type: "object",
    properties: {
      reason: { type: "string", description: "Pourquoi aucun câblage fiable n'est possible (1 phrase)." },
      instructions: {
        type: "string",
        description:
          "Instructions concrètes pour l'utilisateur : comment reformuler le KPI ou la description de la table " +
          "(entité, dimension, mesure du catalogue) pour obtenir le(s) KPI(s) demandés. 2-3 phrases max.",
      },
    },
    required: ["reason", "instructions"],
  },
};

export type ResolvedKpi =
  | { ok: true; spec: AggregateSpec; unitMode: string; agentTitle: string | null; agentName: string }
  | { ok: false; error: string; status: number; instructions?: string };

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
  description?: string | null,
): Promise<ResolvedKpi> {
  const { key: anthropicKey, reason } = getAnthropicKey();
  const persona = getAgentPersona(PAGE_AGENT_KEY[pageKey]);
  if (!anthropicKey) return { ok: false, error: reason ?? "ANTHROPIC_API_KEY not configured", status: 500 };

  const client = new Anthropic({ apiKey: anthropicKey });
  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
    `Tu construis une table de données à partir du KPI décrit par l'utilisateur. ` +
    `IMPÉRATIF DE FIABILITÉ : n'utilise QUE ce catalogue canonique — ${CANONICAL_DOC} ` +
    `Si une combinaison entité/dimension/mesure/champ répond FIDÈLEMENT au besoin (matching à 100 %), ` +
    `appelle build_data_table. Si le besoin ne correspond à AUCUNE combinaison du catalogue ` +
    `(KPI hors périmètre, donnée non disponible, intention ambiguë), appelle no_reliable_match : ` +
    `on ne crée JAMAIS une table approximative — tes instructions aident l'utilisateur à reformuler. ` +
    `Si le besoin implique un montant en euros, mets unit_mode=currency ; sinon count. ` +
    `Pour le titre : REPRENDS fidèlement le KPI écrit par l'utilisateur, en le peaufinant seulement si besoin ` +
    `(orthographe, concision) — ne change pas son sens ni son intention. Réponds uniquement via un outil.`;

  const desc = description?.trim();
  const userMessage =
    `KPI personnalisé demandé : « ${kpi} ».` +
    (desc ? ` Précisions de l'utilisateur pour bien l'interpréter : « ${desc} ».` : "") +
    ` Construis la table correspondante.`;

  let spec: AggregateSpec;
  let unitMode = "count";
  let agentTitle: string | null = null;
  try {
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system,
      tools: [BUILD_TOOL, NO_MATCH_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return { ok: false, error: "L'agent n'a pas pu interpréter ce KPI.", status: 422 };
    // Pas de matching fiable → AUCUNE table créée ; l'agent explique comment
    // modifier la demande pour retrouver le(s) KPI(s) voulus.
    if (toolUse.name === "no_reliable_match") {
      const nm = toolUse.input as { reason?: string; instructions?: string };
      const reason = nm.reason?.trim() || `Aucun câblage fiable trouvé pour « ${kpi} ».`;
      const instructions = nm.instructions?.trim() || "";
      return {
        ok: false,
        error: [`${persona.name} : ${reason}`, instructions].filter(Boolean).join(" — "),
        instructions: instructions || undefined,
        status: 422,
      };
    }
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
  // Dans ce cas l'agent génère des instructions concrètes de reformulation —
  // jamais de table créée sans câblage vérifié à 100 %.
  const check = await computeAggregate(supabase, orgId, [], hubspotToken, spec);
  if (check.error) {
    let instructions = "";
    try {
      const help = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 300,
        system:
          `Tu es ${persona.name}, ${persona.role} chez Revold. Catalogue canonique disponible : ${CANONICAL_DOC}`,
        messages: [
          {
            role: "user",
            content:
              `Le KPI « ${kpi} » n'a pas pu être câblé sur une donnée réelle ` +
              `(spec tentée : ${spec.entity}/${spec.groupBy}/${spec.measure}${spec.field ? `/${spec.field}` : ""} ; erreur : ${check.error}). ` +
              `Donne en 2-3 phrases, adressées à l'utilisateur, des instructions concrètes pour modifier le contenu de sa demande de table ` +
              `(reformulation du KPI, entité/dimension/mesure du catalogue à viser) afin de retrouver le ou les KPIs demandés. ` +
              `Réponds uniquement avec ces instructions, sans préambule.`,
          },
        ],
      });
      instructions = help.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text.trim())
        .join(" ")
        .trim();
    } catch {
      /* fallback message générique ci-dessous */
    }
    return {
      ok: false,
      error:
        `${persona.name} n'a pas trouvé de donnée fiable pour « ${kpi} » — aucune table créée. ` +
        (instructions || "Reformule ta demande en précisant l'entité (deals, factures, subscriptions, tickets…), la dimension (par mois, par statut…) et la mesure (nombre, somme, moyenne)."),
      instructions: instructions || undefined,
      status: 422,
    };
  }

  return { ok: true, spec, unitMode, agentTitle, agentName: persona.name };
}
