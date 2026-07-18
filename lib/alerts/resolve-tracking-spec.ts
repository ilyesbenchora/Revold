import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";

// Équipe / catégorie → persona responsable (aligné sur compose.ts).
const TEAM_PERSONA: Record<string, string> = {
  sales: "performance",
  commercial: "performance",
  marketing: "coaching-marketing",
  revops: "automatisations",
  finance: "paiement-facturation",
  csm: "service-client",
  "service-client": "service-client",
};

const CANONICAL_DOC =
  "deals: dimensions month_created, month_closed, stage — mesures count, ou sum/avg du champ amount. " +
  "invoices: dimensions status, source, month_issued, month_paid — mesures count, ou sum/avg des champs amount_total, amount_paid, amount_due. " +
  "subscriptions: dimensions status, source, month_started, month_canceled — mesures count, ou sum/avg du champ mrr. " +
  "tickets: dimension status — mesure count. " +
  "companies: dimensions segment, industry, country — mesure count. " +
  "contacts: dimensions mql, sql — mesure count.";

const BUILD_TOOL: Anthropic.Tool = {
  name: "build_tracking_spec",
  description:
    "Traduit un KPI décrit en langage naturel (alerte ou objectif) vers une agrégation canonique 100 % calculable, " +
    "pour permettre le rapprochement avec les VRAIES données synchronisées. Ne jamais inventer d'entité, dimension ou champ.",
  input_schema: {
    type: "object",
    properties: {
      computable: { type: "boolean", description: "false si le KPI ne peut PAS être calculé avec le catalogue disponible." },
      entity: { type: "string", enum: ["deals", "invoices", "subscriptions", "tickets", "companies", "contacts"] },
      groupBy: { type: "string", description: "Dimension de regroupement (voir la liste par entité)." },
      measure: { type: "string", enum: ["count", "sum", "avg"] },
      field: { type: "string", description: "Champ numérique pour sum/avg (amount, amount_total, amount_paid, amount_due, mrr). Vide si count." },
      target: { type: "string", description: "Ligne précise à isoler, ex 'active' pour les abonnements actifs. Vide = total de toutes les lignes." },
      multiplier: { type: "number", description: "Conversion linéaire déterministe. 12 pour passer du MRR à l'ARR annuel. 1 sinon." },
      unit_mode: { type: "string", enum: ["count", "currency", "percent"] },
    },
    required: ["computable"],
  },
};

export type TrackingSpec = AggSpec & { unit_mode?: string };

/**
 * Résout un KPI texte (titre + contexte) en spec d'agrégat trackable, PUIS la
 * valide en déterministe (rejet si non calculable sur les données réelles).
 * Best-effort : renvoie null si non résoluble — l'alerte/objectif reste alors
 * informatif plutôt que faux.
 *
 * Exemple : « 200 M€ d'ARR » → subscriptions, sum(mrr), target=active, multiplier=12.
 */
export async function resolveTrackingSpec(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null,
  args: { kpiText: string; description?: string | null; team?: string | null; category?: string | null },
): Promise<TrackingSpec | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !args.kpiText?.trim()) return null;
  const persona = getAgentPersona(TEAM_PERSONA[args.team ?? ""] ?? TEAM_PERSONA[args.category ?? ""] ?? "automatisations");

  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
    `Traduis le KPI de l'utilisateur vers une agrégation canonique 100 % calculable, pour le rapprocher des vraies données. ` +
    `Catalogue disponible — ${CANONICAL_DOC} ` +
    `Règles : ARR = somme des MRR des abonnements ACTIFS × 12 → entity=subscriptions, measure=sum, field=mrr, groupBy=status, target=active, multiplier=12. ` +
    `MRR = idem sans multiplier. CA encaissé → invoices sum(amount_paid). CA signé → deals sum(amount). ` +
    `Choisis la combinaison la plus proche et 100 % calculable. Si rien ne colle, computable=false. Réponds uniquement via l'outil.`;
  const userMsg =
    `KPI à tracker : « ${args.kpiText.trim()} ».` +
    (args.description?.trim() ? ` Contexte : « ${args.description.trim()} ».` : "") +
    ` Donne la spec d'agrégat correspondante.`;

  let spec: TrackingSpec;
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system,
      tools: [BUILD_TOOL],
      tool_choice: { type: "tool", name: "build_tracking_spec" },
      messages: [{ role: "user", content: userMsg }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return null;
    const inp = toolUse.input as {
      computable?: boolean; entity?: string; groupBy?: string; measure?: string;
      field?: string; target?: string; multiplier?: number; unit_mode?: string;
    };
    if (inp.computable === false || !inp.entity || !inp.groupBy) return null;
    spec = {
      entity: String(inp.entity),
      groupBy: String(inp.groupBy),
      measure: inp.measure ?? "count",
      field: inp.field ? String(inp.field) : null,
      target: inp.target ? String(inp.target) : null,
      multiplier: typeof inp.multiplier === "number" && inp.multiplier > 0 ? inp.multiplier : 1,
      unit_mode: inp.unit_mode ?? "count",
    };
  } catch {
    return null;
  }

  // Validation déterministe : la spec DOIT produire une valeur réelle.
  const v = await valueFromAggSpec(supabase, orgId, hubspotToken, spec);
  if (v === null) return null;
  return spec;
}
