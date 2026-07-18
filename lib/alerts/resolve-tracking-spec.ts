import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";
import { RECON_RECIPES } from "@/lib/reconciliation/engine";

const RECON_IDS = Object.keys(RECON_RECIPES);
const RECON_SET = new Set(RECON_IDS);
const RECON_DOC = Object.values(RECON_RECIPES).map((r) => `${r.id} = ${r.desc}`).join(" ");

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

// KPI catalogués calculables en déterministe (lib/alerts/kpi-resolver.ts).
const FORECAST_TYPES = [
  "closing_rate", "pipeline_coverage", "deal_activation", "pipeline_value", "avg_deal_size",
  "deals_at_risk", "revenue_won", "deals_count", "deals_won_count", "stagnant_deals",
  "conversion_rate", "orphan_rate", "phone_enrichment", "dormant_reactivation", "weighted_pipeline",
  "sales_cycle_days", "deals_no_amount", "data_completeness", "mql_to_sql_rate",
  "contacts_by_source", "source_to_lifecycle", "source_to_deal_created", "source_to_deal_won",
] as const;
const FORECAST_SET = new Set<string>(FORECAST_TYPES);

const CANONICAL_DOC =
  "deals: dimensions month_created, month_closed, stage — mesures count, ou sum/avg du champ amount. " +
  "invoices: dimensions status, source, month_issued, month_paid — mesures count, ou sum/avg des champs amount_total, amount_paid, amount_due. " +
  "subscriptions: dimensions status, source, month_started, month_canceled — mesures count, ou sum/avg du champ mrr. " +
  "tickets: dimension status — mesure count. " +
  "companies: dimensions segment, industry, country — mesure count. " +
  "contacts: dimensions mql, sql — mesure count.";

const BUILD_TOOL: Anthropic.Tool = {
  name: "wire_kpi",
  description:
    "Rattache OBLIGATOIREMENT un KPI (alerte ou objectif) aux VRAIES données de Revold, soit vers un indicateur " +
    "catalogué (forecast_type), soit vers une agrégation canonique. Le but est un câblage 100 % : choisis toujours " +
    "le rapprochement le plus proche calculable. Ne jamais inventer d'entité, dimension ou champ.",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["forecast", "aggregate", "reconciled"], description: "reconciled si le KPI croise plusieurs outils (CRM↔facturation↔support) ; forecast si indicateur catalogué ; sinon aggregate mono-entité." },
      recipe: { type: "string", enum: [...RECON_IDS], description: "Requis si mode=reconciled." },
      forecast_type: { type: "string", enum: [...FORECAST_TYPES], description: "Requis si mode=forecast." },
      entity: { type: "string", enum: ["deals", "invoices", "subscriptions", "tickets", "companies", "contacts"], description: "Requis si mode=aggregate." },
      groupBy: { type: "string", description: "Dimension de regroupement (mode=aggregate)." },
      measure: { type: "string", enum: ["count", "sum", "avg"] },
      field: { type: "string", description: "Champ numérique pour sum/avg (amount, amount_total, amount_paid, amount_due, mrr)." },
      target: { type: "string", description: "Ligne précise à isoler, ex 'active' pour abonnements actifs. Vide = total." },
      multiplier: { type: "number", description: "Conversion linéaire déterministe. 12 pour MRR→ARR annuel. 1 sinon." },
      unit_mode: { type: "string", enum: ["count", "currency", "percent"] },
    },
    required: ["mode"],
  },
};

export type TrackingResolution = {
  forecast_type: string | null;
  agg_spec: (AggSpec & { unit_mode?: string }) | null;
  recon_recipe: string | null;
};

const NONE: TrackingResolution = { forecast_type: null, agg_spec: null, recon_recipe: null };

const fc = (forecast_type: string): TrackingResolution => ({ forecast_type, agg_spec: null, recon_recipe: null });
const rc = (recon_recipe: string): TrackingResolution => ({ forecast_type: null, agg_spec: null, recon_recipe });
const ag = (agg_spec: AggSpec & { unit_mode?: string }): TrackingResolution => ({ forecast_type: null, agg_spec, recon_recipe: null });

/** Fallback DÉTERMINISTE : garantit un câblage même si l'agent échoue. */
function heuristicWiring(kpiText: string, unit?: string | null): TrackingResolution {
  const t = (kpiText || "").toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // Cross-source (recettes réconciliées) d'abord.
  if (has(/écart|ecart|signé.*factur|factur.*signé|crm.*factur/)) return rc("crm_vs_billed_gap");
  if (has(/fuite|non factur|sans factur|leakage/)) return rc("revenue_leakage");
  if (has(/à risque|a risque|at.?risk|churn/) && has(/mrr|abonnement|revenu|compte/)) return rc("mrr_at_risk");
  if (has(/impay|unpaid|due|en retard/)) return rc("unpaid_amount");
  if (has(/réconcili|reconcili/)) return rc("reconciled_pct");
  if (has(/\barr\b|revenu(e|s)? annuel/)) return rc("arr_reconciled");
  if (has(/\bmrr\b|récurrent|recurrent|abonnement/)) return rc("mrr_reconciled");
  if (has(/encaiss|payé|paye|paid/)) return rc("billed_paid");

  // Indicateurs catalogués.
  if (has(/closing|clôtur|cloture|taux de gain|win rate/)) return fc("closing_rate");
  if (has(/conversion|lead.?opp|mql|sql/)) return fc("conversion_rate");
  if (has(/pipeline/)) return fc("pipeline_value");
  if (has(/risque|at.?risk/)) return fc("deals_at_risk");
  if (has(/facture|invoice/)) return rc("billed_paid");
  if (has(/ca\b|chiffre|revenue|revenu|montant|signé|signe/) || unit === "currency") return fc("revenue_won");
  if (unit === "percent") return fc("closing_rate");
  return fc("deals_count");
}

/**
 * Rattache un KPI texte (nom + chiffre + description) aux vraies données. Vise le
 * 100 % : l'agent choisit un indicateur catalogué OU une agrégation ; si l'agent
 * échoue ou n'est pas dispo, un fallback déterministe garantit le câblage. La
 * spec d'agrégat est validée sur les vraies données avant d'être retenue.
 */
export async function resolveTrackingSpec(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null,
  args: {
    kpiText: string;
    description?: string | null;
    team?: string | null;
    category?: string | null;
    value?: number | null;
    unit?: string | null;
    /** Entités canoniques réellement alimentées pour l'org (à privilégier). */
    availableEntities?: string[] | null;
  },
): Promise<TrackingResolution> {
  if (!args.kpiText?.trim()) return NONE;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Sans clé API : fallback déterministe (on ne laisse jamais l'élément non câblé).
  if (!apiKey) return heuristicWiring(args.kpiText, args.unit);

  const available = args.availableEntities ?? [];
  const persona = getAgentPersona(TEAM_PERSONA[args.team ?? ""] ?? TEAM_PERSONA[args.category ?? ""] ?? "automatisations");
  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. MISSION PRINCIPALE : rattacher ce KPI aux vraies données à 100 %, ` +
    `en EXPLOITANT les données réellement présentes — jamais sur du vide. C'est ton expertise : savoir quoi aller chercher. ` +
    `TROIS voies : (0) mode=reconciled si le KPI CROISE plusieurs outils (CRM ↔ facturation ↔ support) — recettes à jointure réelle : ${RECON_DOC} ; ` +
    `(1) mode=forecast si un indicateur catalogué mono-source correspond — ${[...FORECAST_TYPES].join(", ")} ; ` +
    `(2) mode=aggregate sinon, via le catalogue canonique — ${CANONICAL_DOC} ` +
    `PRIVILÉGIE mode=reconciled dès qu'il s'agit de revenu réel/ARR/MRR/encaissé/impayés/écart CRM-facturation/fuite de revenu/MRR à risque. ` +
    `Données RÉELLEMENT alimentées pour cette org : ${available.length ? available.join(", ") : "aucune détectée pour l'instant"}. ` +
    `PRIORISE ces entités : le rapprochement DOIT tomber sur des données présentes. ` +
    `Si la donnée idéale n'est pas alimentée, construis le MEILLEUR PROXY calculable à partir des entités disponibles — ` +
    `ex : ARR ≈ deals sum(amount) des deals GAGNÉS (annualisés) si les abonnements ne sont pas synchronisés ; ` +
    `MRR ≈ ARR/12 ; CA ≈ deals sum(amount). Utilise multiplier/target pour approcher au plus juste. ` +
    `Sers-toi du NOM du KPI, du CHIFFRE cible et de la DESCRIPTION pour choisir le rapprochement le plus fidèle. ` +
    `Règles montants (si la source existe) : ARR = sum(mrr) des abonnements ACTIFS × 12 (subscriptions, sum, mrr, groupBy=status, target=active, multiplier=12) ; ` +
    `MRR = idem sans multiplier ; CA encaissé = invoices sum(amount_paid) ; CA signé = deals sum(amount) ou forecast_type=revenue_won. ` +
    `Choisis TOUJOURS un rapprochement calculable sur les données présentes, jamais rien d'informatif. Réponds uniquement via l'outil.`;
  const numTxt = args.value != null ? ` Chiffre cible : ${args.value}${args.unit === "currency" ? " €" : args.unit === "percent" ? " %" : ""}.` : "";
  const userMsg =
    `KPI : « ${args.kpiText.trim()} ».${numTxt}` +
    (args.description?.trim() ? ` Description : « ${args.description.trim()} ».` : "") +
    ` Rattache-le aux vraies données.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system,
      tools: [BUILD_TOOL],
      tool_choice: { type: "tool", name: "wire_kpi" },
      messages: [{ role: "user", content: userMsg }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return heuristicWiring(args.kpiText, args.unit);
    const inp = toolUse.input as {
      mode?: string; recipe?: string; forecast_type?: string; entity?: string; groupBy?: string;
      measure?: string; field?: string; target?: string; multiplier?: number; unit_mode?: string;
    };

    // Voie réconciliée : recette de jointure cross-source connue.
    if (inp.mode === "reconciled" && inp.recipe && RECON_SET.has(inp.recipe)) {
      return { forecast_type: null, agg_spec: null, recon_recipe: inp.recipe };
    }

    // Voie catalogué : sûr si c'est un forecast_type connu.
    if (inp.mode === "forecast" && inp.forecast_type && FORECAST_SET.has(inp.forecast_type)) {
      return { forecast_type: inp.forecast_type, agg_spec: null, recon_recipe: null };
    }

    // Voie agrégat : validée sur les vraies données.
    if (inp.entity && inp.groupBy) {
      const spec: AggSpec & { unit_mode?: string } = {
        entity: String(inp.entity),
        groupBy: String(inp.groupBy),
        measure: inp.measure ?? "count",
        field: inp.field ? String(inp.field) : null,
        target: inp.target ? String(inp.target) : null,
        multiplier: typeof inp.multiplier === "number" && inp.multiplier > 0 ? inp.multiplier : 1,
        unit_mode: inp.unit_mode ?? args.unit ?? "count",
      };
      const v = await valueFromAggSpec(supabase, orgId, hubspotToken, spec);
      if (v !== null) return { forecast_type: null, agg_spec: spec, recon_recipe: null };
    }

    // L'agent n'a pas produit un câblage calculable → fallback déterministe.
    return heuristicWiring(args.kpiText, args.unit);
  } catch {
    return heuristicWiring(args.kpiText, args.unit);
  }
}
