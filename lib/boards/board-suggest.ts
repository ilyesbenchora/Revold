/**
 * Composition de tableau de bord proposée par l'AGENT (2b du plan) — page
 * Templates : l'utilisateur décrit son besoin, l'agent compose tuiles + tables
 * à partir du catalogue canonique, des volumes réellement synchronisés et des
 * champs métier supplémentaires des connecteurs sur mesure.
 *
 * Même doctrine que le funnel : l'agent COMPOSE, il ne calcule jamais — chaque
 * élément est une spec agrégée déterministe (valueFromAggSpec/computeAggregate),
 * SANITISÉE contre des listes blanches avant tout enregistrement. Ce qui est
 * affiché à l'utilisateur est exactement ce qui est créé.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import type { BoardComposition, TemplateTile, TemplateTable } from "@/lib/boards/board-templates";

/** Dimensions valides par entité (miroir de AGG_SPECS — tool-library). */
const ENTITY_DIMS: Record<string, string[]> = {
  deals: ["status", "outcome", "stage", "pipeline", "stage_pipeline", "close_date_state", "month_created", "month_closed"],
  invoices: ["status", "source", "month_issued", "month_paid"],
  subscriptions: ["status", "source", "month_started", "month_canceled"],
  transactions: ["month_transaction", "direction", "category", "source"],
  tickets: ["status"],
  companies: ["segment", "industry", "country"],
  contacts: ["mql", "sql"],
};

/** Champs numériques valides par entité (miroir de AGG_SPECS.numeric). */
const ENTITY_NUM_FIELDS: Record<string, string[]> = {
  deals: ["amount"],
  invoices: ["amount_total", "amount_paid", "amount_due"],
  subscriptions: ["mrr"],
  transactions: ["amount", "amount_in", "amount_out"],
  tickets: [],
  companies: [],
  contacts: [],
};

/** Tables physiques (comptages de volumes). */
const ENTITY_TABLE: Record<string, string> = {
  deals: "deals",
  invoices: "invoices",
  subscriptions: "subscriptions",
  transactions: "bank_transactions",
  tickets: "tickets",
  contacts: "contacts",
  companies: "companies",
};

export type KnownExtraField = { entity: string; id: string; label: string; kind: "number" | "label" };

/** Champs métier supplémentaires de TOUS les connecteurs sur mesure actifs. */
export async function listKnownExtraFields(
  supabase: SupabaseClient,
  orgId: string,
): Promise<KnownExtraField[]> {
  try {
    const { data } = await supabase
      .from("custom_connector_endpoints")
      .select("entity, extra_fields, is_active")
      .eq("organization_id", orgId);
    const out: KnownExtraField[] = [];
    for (const ep of data ?? []) {
      if (ep.is_active === false) continue;
      for (const f of (Array.isArray(ep.extra_fields) ? ep.extra_fields : []) as Array<{ id?: string; label?: string; kind?: string }>) {
        if (!f?.id || !f.label) continue;
        out.push({ entity: String(ep.entity), id: f.id, label: f.label, kind: f.kind === "number" ? "number" : "label" });
      }
    }
    return out;
  } catch {
    return []; // colonne extra_fields absente → aucun champ métier
  }
}

/**
 * Sanitise une composition (LLM ou client) contre les listes blanches —
 * ne laisse passer QUE des specs 100 % calculables. Ce qui ne valide pas est
 * silencieusement écarté (compté dans `dropped`).
 */
export function sanitizeComposition(
  raw: unknown,
  extras: KnownExtraField[],
): { composition: BoardComposition; dropped: number } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { tiles?: unknown; tables?: unknown };
  let dropped = 0;

  const validDim = (entity: string, groupBy: string): boolean => {
    if (ENTITY_DIMS[entity]?.includes(groupBy)) return true;
    if (groupBy.startsWith("extra.")) {
      const id = groupBy.slice(6);
      return extras.some((e) => e.entity === entity && e.id === id && e.kind === "label");
    }
    return false;
  };
  const validField = (entity: string, field: string): boolean => {
    if (ENTITY_NUM_FIELDS[entity]?.includes(field)) return true;
    if (field.startsWith("extra.")) {
      const id = field.slice(6);
      return extras.some((e) => e.entity === entity && e.id === id && e.kind === "number");
    }
    return false;
  };

  const tiles: TemplateTile[] = [];
  for (const t of (Array.isArray(obj.tiles) ? obj.tiles : []).slice(0, 6)) {
    const x = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const agg = (x.agg && typeof x.agg === "object" ? x.agg : x) as Record<string, unknown>;
    const title = typeof x.title === "string" ? x.title.trim().slice(0, 60) : "";
    const entity = String(agg.entity ?? "");
    const groupBy = String(agg.groupBy ?? agg.group_by ?? "");
    const measure = ["count", "sum", "avg"].includes(String(agg.measure)) ? String(agg.measure) : "count";
    const field = typeof agg.field === "string" && agg.field.trim() ? agg.field.trim() : undefined;
    if (!title || !ENTITY_TABLE[entity] || !validDim(entity, groupBy)) { dropped++; continue; }
    if (measure !== "count" && (!field || !validField(entity, field))) { dropped++; continue; }
    const target = typeof agg.target === "string" && agg.target.trim() ? agg.target.trim().slice(0, 60) : undefined;
    const percentOfTotal = agg.percent_of_total === true && !!target;
    const unitRaw = String(x.unit ?? x.unit_mode ?? "");
    const unit: TemplateTile["unit"] = percentOfTotal ? "percent" : unitRaw === "currency" ? "currency" : unitRaw === "percent" ? "percent" : "count";
    tiles.push({
      title,
      unit,
      agg: {
        entity,
        groupBy,
        measure,
        ...(measure !== "count" && field ? { field } : {}),
        ...(target ? { target } : {}),
        ...(percentOfTotal ? { percent_of_total: true } : {}),
      },
    });
  }

  const VIEWS = new Set(["table", "bar", "line", "donut"]);
  const tables: TemplateTable[] = [];
  for (const t of (Array.isArray(obj.tables) ? obj.tables : []).slice(0, 4)) {
    const x = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const title = typeof x.title === "string" ? x.title.trim().slice(0, 60) : "";
    const entity = String(x.entity ?? "");
    const groupBy = String(x.group_by ?? x.groupBy ?? "");
    const measure = ["count", "sum", "avg"].includes(String(x.measure)) ? String(x.measure) : "count";
    const field = typeof x.field === "string" && x.field.trim() ? x.field.trim() : null;
    if (!title || !ENTITY_TABLE[entity] || !validDim(entity, groupBy)) { dropped++; continue; }
    if (measure !== "count" && (!field || !validField(entity, field))) { dropped++; continue; }
    const unitRaw = String(x.unit_mode ?? x.unit ?? "");
    tables.push({
      title,
      entity,
      group_by: groupBy,
      measure,
      field: measure !== "count" ? field : null,
      unit_mode: unitRaw === "currency" ? "currency" : unitRaw === "percent" ? "percent" : "count",
      view: VIEWS.has(String(x.view)) ? (String(x.view) as TemplateTable["view"]) : "table",
      description: typeof x.description === "string" ? x.description.trim().slice(0, 200) || undefined : undefined,
    });
  }

  return { composition: { tiles, tables }, dropped };
}

const PROPOSE_TOOL: Anthropic.Tool = {
  name: "propose_board",
  description:
    "Propose la composition d'un tableau de bord répondant au besoin décrit : jusqu'à 4 tuiles KPI et 3 tables/graphiques, " +
    "en utilisant UNIQUEMENT les entités/dimensions/champs listés (catalogue canonique + champs métier extra.*). " +
    "Ne jamais inventer une dimension ou un champ.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nom court du tableau (max ~4 mots), fidèle au besoin." },
      tiles: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            unit: { type: "string", enum: ["count", "currency", "percent"] },
            entity: { type: "string" },
            groupBy: { type: "string" },
            measure: { type: "string", enum: ["count", "sum", "avg"] },
            field: { type: "string", description: "Champ numérique si sum/avg." },
            target: { type: "string", description: "Ligne isolée par la tuile (sinon total)." },
            percent_of_total: { type: "boolean", description: "true pour un taux : 100 × cible / total (unit percent)." },
          },
          required: ["title", "entity", "groupBy", "measure"],
        },
      },
      tables: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            entity: { type: "string" },
            group_by: { type: "string" },
            measure: { type: "string", enum: ["count", "sum", "avg"] },
            field: { type: "string" },
            unit_mode: { type: "string", enum: ["count", "currency", "percent"] },
            view: { type: "string", enum: ["table", "bar", "line", "donut"] },
            description: { type: "string" },
          },
          required: ["title", "entity", "group_by", "measure"],
        },
      },
    },
    required: ["name", "tiles"],
  },
};

export type BoardProposal = { name: string; composition: BoardComposition; dropped: number };

/** L'agent compose un tableau depuis le besoin décrit — specs sanitisées. */
export async function proposeBoardComposition(
  supabase: SupabaseClient,
  orgId: string,
  brief: string,
): Promise<{ ok: true; proposal: BoardProposal } | { ok: false; error: string; status: number }> {
  const { key: anthropicKey, reason } = getAnthropicKey();
  if (!anthropicKey) return { ok: false, error: reason ?? "ANTHROPIC_API_KEY not configured", status: 500 };

  // Contexte réel : volumes par entité + outils connectés + champs métier.
  const [extras, connected, counts] = await Promise.all([
    listKnownExtraFields(supabase, orgId),
    getConnectedTools(supabase, orgId).catch(() => []),
    (async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        Object.entries(ENTITY_TABLE).map(async ([entity, table]) => {
          try {
            const { count } = await supabase
              .from(table)
              .select("id", { count: "exact", head: true })
              .eq("organization_id", orgId);
            out[entity] = count ?? 0;
          } catch {
            out[entity] = 0;
          }
        }),
      );
      return out;
    })(),
  ]);

  const catalogDoc = Object.entries(ENTITY_DIMS)
    .map(([entity, dims]) => {
      const nums = ENTITY_NUM_FIELDS[entity] ?? [];
      const extraDims = extras.filter((e) => e.entity === entity && e.kind === "label").map((e) => `extra.${e.id} (« ${e.label} »)`);
      const extraNums = extras.filter((e) => e.entity === entity && e.kind === "number").map((e) => `extra.${e.id} (« ${e.label} »)`);
      return (
        `${entity} (${counts[entity] ?? 0} enregistrements) : dimensions ${[...dims, ...extraDims].join(", ")} — ` +
        `mesures count${nums.length || extraNums.length ? `, ou sum/avg des champs ${[...nums, ...extraNums].join(", ")}` : ""}`
      );
    })
    .join(". ");

  const toolLabels = connected.filter((t) => t.category !== "communication").map((t) => t.label);

  const system =
    `Tu composes un TABLEAU DE BORD Revold à partir du besoin décrit par l'utilisateur. ` +
    `Tu ne calcules rien : chaque tuile et chaque table est une spec agrégée déterministe, calculée ensuite sur les données réelles. ` +
    `IMPÉRATIF : n'utilise QUE ce catalogue (entités, dimensions, champs), jamais autre chose — ${catalogDoc}. ` +
    `N'utilise JAMAIS une entité à 0 enregistrement. ` +
    (toolLabels.length ? `Outils connectés : ${toolLabels.join(", ")}. ` : "") +
    `Choisis 3-4 tuiles (lecture en un coup d'œil : privilégie montants en currency, taux en percent avec target + percent_of_total) ` +
    `et 2-3 tables/graphiques complémentaires (bar pour des répartitions, line pour des dimensions month_*, donut pour des parts). ` +
    `Titres courts, en français. Réponds uniquement via l'outil propose_board.`;

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1200,
      system,
      tools: [PROPOSE_TOOL],
      tool_choice: { type: "tool", name: "propose_board" },
      messages: [{ role: "user", content: `Besoin décrit : « ${brief.slice(0, 600)} ». Compose le tableau de bord.` }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return { ok: false, error: "L'agent n'a pas pu composer de tableau.", status: 422 };
    const input = toolUse.input as { name?: string; tiles?: unknown; tables?: unknown };
    const { composition, dropped } = sanitizeComposition(input, extras);
    if (composition.tiles.length === 0 && composition.tables.length === 0) {
      return { ok: false, error: "Aucune composition fiable pour ce besoin — précise les données visées (deals, factures, abonnements, transactions, tickets…).", status: 422 };
    }
    const name = (input.name ?? "").trim().slice(0, 60) || "Tableau proposé";
    return { ok: true, proposal: { name, composition, dropped } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur agent", status: 500 };
  }
}
