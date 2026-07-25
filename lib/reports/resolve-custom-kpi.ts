import Anthropic from "@anthropic-ai/sdk";
import { computeAggregate, AGG_ENTITY_TABLES, type AggregateSpec } from "@/lib/ai/agents/tool-library";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { PAGE_AGENT_KEY } from "@/lib/reports/data-table-presets";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";

// Catalogue canonique disponible (même contrat que aggregate_canonical) : garantit
// que l'agent ne peut produire qu'une table 100 % calculable et fiable.
const CANONICAL_DOC =
  "deals: dimensions month_created, month_closed, stage — mesures count, ou sum/avg du champ amount. " +
  "invoices (factures émises/reçues): dimensions status, source, month_issued, month_paid — mesures count, ou sum/avg des champs amount_total, amount_paid, amount_due. " +
  "transactions (transactions bancaires = paiements réels encaissés/décaissés, même sans facture — ex : « paiements », « encaissements », « cash », « dépenses ») : " +
  "dimensions month_transaction, direction, category, source — mesures count, ou sum/avg des champs amount_in (encaissements), amount_out (décaissements), amount (flux net signé = encaissements − décaissements). " +
  "RÈGLE CHAMPS TRANSACTIONS : « paiements », « encaissements », « CA encaissé », « rentrées d'argent » → amount_in ; « dépenses », « sorties », « charges » → amount_out ; " +
  "amount (net) UNIQUEMENT si le KPI parle explicitement de flux net, de variation ou de solde. " +
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
      entity: { type: "string", enum: ["deals", "invoices", "transactions", "subscriptions", "tickets", "companies", "contacts"] },
      groupBy: { type: "string", description: "Dimension de regroupement (voir la liste par entité)." },
      measure: { type: "string", enum: ["count", "sum", "avg"] },
      field: { type: "string", description: "Champ numérique pour sum/avg (amount, amount_total, amount_paid, amount_due, amount_in, amount_out, mrr). Vide si count." },
      pipeline: {
        type: "string",
        description:
          "Deals UNIQUEMENT : si le KPI cible UN pipeline précis (ex : « dans le pipeline Storee retail »), " +
          "son nom EXACT tel qu'écrit par l'utilisateur. Sans lui, les étapes homonymes de TOUS les pipelines " +
          "sont mélangées — données fausses. Omettre si aucun pipeline n'est nommé.",
      },
      unit_mode: { type: "string", enum: ["count", "currency", "percent"], description: "count si comptage, currency si montant en €." },
      date_from: {
        type: "string",
        description:
          "UNIQUEMENT si le KPI ou sa description mentionne EXPLICITEMENT une période (ex. « Q1 2026 », « depuis janvier », « sur 2025 ») : borne de début au format YYYY-MM-DD, résolue en dates absolues à partir de la date du jour. Omettre sinon.",
      },
      date_to: {
        type: "string",
        description: "Borne de fin YYYY-MM-DD de la période explicitement mentionnée. Omettre si aucune période n'est mentionnée.",
      },
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
  | { ok: true; spec: AggregateSpec; unitMode: string; agentTitle: string | null; agentName: string; rowCount: number }
  | { ok: false; error: string; status: number; instructions?: string };

/**
 * Volume réel de chaque entité canonique pour l'org (filtré par sources quand
 * l'entité porte primary_source). Garde-fou du câblage : l'agent ne doit pas
 * brancher un KPI sur un endpoint vide quand une autre entité a des données.
 * Exporté pour l'étape « Vérification » du funnel (volumes des alternatives).
 */
export async function countEntityRows(
  supabase: Parameters<typeof computeAggregate>[0],
  orgId: string,
  sources: string[],
): Promise<Record<string, number>> {
  const billing = sources.filter((s) => s !== "hubspot");
  const out: Record<string, number> = {};
  await Promise.all(
    AGG_ENTITY_TABLES.map(async ({ entity, table, hasSource }) => {
      try {
        let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
        if (hasSource && billing.length > 0) q = q.in("primary_source", billing);
        const { count } = await q;
        out[entity] = count ?? 0;
      } catch {
        out[entity] = 0;
      }
    }),
  );
  return out;
}

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
  /** Outils sources choisis dans le funnel (ex : ["pennylane"]) — contraignent le câblage. */
  sources: string[] = [],
  /** Entité IMPOSÉE par l'utilisateur à l'étape « Vérification » (ex : "transactions"). */
  preferredEntity?: string | null,
): Promise<ResolvedKpi> {
  const { key: anthropicKey, reason } = getAnthropicKey();
  const persona = getAgentPersona(PAGE_AGENT_KEY[pageKey]);
  if (!anthropicKey) return { ok: false, error: reason ?? "ANTHROPIC_API_KEY not configured", status: 500 };

  const client = new Anthropic({ apiKey: anthropicKey });
  // Outils sources choisis dans le funnel → contrainte forte sur le câblage :
  // les entités invoices/subscriptions portent la source de chaque ligne
  // (Stripe, Pennylane, Chargebee…) ; deals/contacts/companies viennent du CRM.
  const sourceLabels = sources.map((k) => getConnectableTool(k)?.label ?? k);
  const crmSelected = sources.some((k) => getConnectableTool(k)?.category === "crm");
  const sourcesRule = sources.length
    ? `OUTILS SOURCES CHOISIS PAR L'UTILISATEUR : ${sourceLabels.join(", ")}. ` +
      `Le KPI DOIT être câblé sur les données de ces outils. Les entités invoices et subscriptions ` +
      `portent la source de chaque ligne (facturation/compta) ; deals, contacts et companies viennent du CRM. ` +
      (crmSelected
        ? ""
        : `Aucun CRM n'est sélectionné : ne câble PAS sur deals/contacts/companies — vise invoices ou subscriptions ` +
          `(ex : « paiements » → invoices, dimension month_paid, somme de amount_paid). ` +
          `Si aucune combinaison cohérente avec ces outils n'existe, appelle no_reliable_match. `)
    : "";
  // Entité imposée à l'étape « Vérification » : l'agent construit le câblage
  // sur CETTE entité (dimension/mesure cohérentes) ou assume no_reliable_match.
  const entityRule = preferredEntity
    ? `CONTRAINTE ABSOLUE : l'utilisateur impose la source de données « ${preferredEntity} ». ` +
      `Construis le câblage sur CETTE entité uniquement (choisis la dimension, la mesure et le champ ` +
      `les plus fidèles au KPI sur cette entité). Si le KPI n'a vraiment aucun sens sur cette entité, ` +
      `appelle no_reliable_match en expliquant pourquoi. `
    : "";
  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
    `Tu construis une table de données à partir du KPI décrit par l'utilisateur. ` +
    entityRule +
    sourcesRule +
    `IMPÉRATIF DE FIABILITÉ : n'utilise QUE ce catalogue canonique — ${CANONICAL_DOC} ` +
    `Si une combinaison entité/dimension/mesure/champ répond FIDÈLEMENT au besoin (matching à 100 %), ` +
    `appelle build_data_table. Si le besoin ne correspond à AUCUNE combinaison du catalogue ` +
    `(KPI hors périmètre, donnée non disponible, intention ambiguë), appelle no_reliable_match : ` +
    `on ne crée JAMAIS une table approximative — tes instructions aident l'utilisateur à reformuler. ` +
    `Si le besoin implique un montant en euros, mets unit_mode=currency ; sinon count. ` +
    `Date du jour : ${new Date().toISOString().slice(0, 10)}. Si le KPI ou sa description mentionne explicitement une période, ` +
    `convertis-la en dates absolues (date_from/date_to) ; sinon n'envoie PAS ces champs. ` +
    `Pour le titre : REPRENDS fidèlement le KPI écrit par l'utilisateur, en le peaufinant seulement si besoin ` +
    `(orthographe, concision) — ne change pas son sens ni son intention. Réponds uniquement via un outil.`;

  const desc = description?.trim();
  const userMessage =
    `KPI personnalisé demandé : « ${kpi} ».` +
    (desc ? ` Précisions de l'utilisateur pour bien l'interpréter : « ${desc} ».` : "") +
    (sourceLabels.length ? ` Outils sources sélectionnés : ${sourceLabels.join(", ")}.` : "") +
    ` Construis la table correspondante.`;

  type AskResult =
    | { kind: "spec"; spec: AggregateSpec; unitMode: string; agentTitle: string | null }
    | { kind: "error"; res: ResolvedKpi & { ok: false } };

  // Un tour d'interprétation par l'agent. `extraContext` = relance du garde-fou
  // « données réelles » (volumes par entité quand le premier câblage est vide).
  async function ask(extraContext?: string): Promise<AskResult> {
    try {
      const resp = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 500,
        system,
        tools: [BUILD_TOOL, NO_MATCH_TOOL],
        tool_choice: { type: "any" },
        messages: [{ role: "user", content: extraContext ? `${userMessage}\n\n${extraContext}` : userMessage }],
      });
      const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUse) return { kind: "error", res: { ok: false, error: "L'agent n'a pas pu interpréter ce KPI.", status: 422 } };
      // Pas de matching fiable → AUCUNE table créée ; l'agent explique comment
      // modifier la demande pour retrouver le(s) KPI(s) voulus.
      if (toolUse.name === "no_reliable_match") {
        const nm = toolUse.input as { reason?: string; instructions?: string };
        const reason = nm.reason?.trim() || `Aucun câblage fiable trouvé pour « ${kpi} ».`;
        const instructions = nm.instructions?.trim() || "";
        return {
          kind: "error",
          res: {
            ok: false,
            error: [`${persona.name} : ${reason}`, instructions].filter(Boolean).join(" — "),
            instructions: instructions || undefined,
            status: 422,
          },
        };
      }
      const inp = toolUse.input as {
        title?: string; entity?: string; groupBy?: string; measure?: string; field?: string; unit_mode?: string;
        pipeline?: string; date_from?: string; date_to?: string;
      };
      // Période explicitement mentionnée dans le KPI/description → dates absolues
      // extraites par l'agent (validées au format), sinon null (pas de filtre).
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      const dFrom = inp.date_from && ISO_DATE.test(inp.date_from) ? inp.date_from : null;
      const dTo = inp.date_to && ISO_DATE.test(inp.date_to) ? inp.date_to : null;
      return {
        kind: "spec",
        agentTitle: inp.title?.trim() || null,
        unitMode: inp.unit_mode === "currency" ? "currency" : inp.unit_mode === "percent" ? "percent" : "count",
        spec: {
          entity: String(inp.entity ?? ""),
          groupBy: String(inp.groupBy ?? ""),
          measure: inp.measure ?? "count",
          field: inp.field ? String(inp.field) : null,
          pipeline: inp.entity === "deals" && inp.pipeline?.trim() ? inp.pipeline.trim() : null,
          date_from: dFrom && dTo && dFrom <= dTo ? dFrom : null,
          date_to: dFrom && dTo && dFrom <= dTo ? dTo : null,
        },
      };
    } catch (err) {
      return { kind: "error", res: { ok: false, error: err instanceof Error ? err.message : "Erreur agent", status: 500 } };
    }
  }

  let attempt = await ask();
  if (attempt.kind === "error") return attempt.res;
  let { spec, unitMode, agentTitle } = attempt;

  // Validation déterministe : on rejette toute spec non calculable (fiabilité).
  // Exécutée avec le MÊME filtre de sources que le recalcul de la table.
  let check = await computeAggregate(supabase, orgId, sources, hubspotToken, spec);

  // Garde-fou « données réelles » : câblage calculable mais VIDE (ex : KPI
  // « paiements » branché sur invoices alors que l'org n'a que des transactions
  // bancaires) → une relance avec les volumes réels par entité. L'agent recâble
  // sur un endpoint qui contient des données, ou assume no_reliable_match.
  // Désactivé quand l'utilisateur impose l'entité (choix assumé, volume affiché).
  if (!preferredEntity && !check.error && check.hasData === false) {
    const counts = await countEntityRows(supabase, orgId, sources);
    const withData = Object.entries(counts).filter(([, n]) => n > 0);
    if ((counts[spec.entity] ?? 0) === 0 && withData.length > 0) {
      const retry = await ask(
        `ATTENTION : un premier câblage sur l'entité « ${spec.entity} » a renvoyé ZÉRO donnée pour ces sources. ` +
        `Volumes réels par entité : ${Object.entries(counts).map(([e, n]) => `${e}=${n}`).join(", ")}. ` +
        `Recâble le KPI sur une entité qui contient des données UNIQUEMENT si elle répond fidèlement au besoin ` +
        `(ex : « paiements » sans facture émise → transactions bancaires, champ amount_in). ` +
        `Si aucune entité avec données ne correspond au besoin, appelle no_reliable_match.`,
      );
      if (retry.kind === "error") return retry.res;
      const recheck = await computeAggregate(supabase, orgId, sources, hubspotToken, retry.spec);
      if (!recheck.error) {
        attempt = retry;
        ({ spec, unitMode, agentTitle } = retry);
        check = recheck;
      }
    }
  }
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

  return { ok: true, spec, unitMode, agentTitle, agentName: persona.name, rowCount: Number(check.totalRows) || 0 };
}
