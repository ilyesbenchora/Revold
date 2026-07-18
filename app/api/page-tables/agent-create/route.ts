import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate, type AggregateSpec } from "@/lib/ai/agents/tool-library";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { PAGE_AGENT_KEY } from "@/lib/reports/data-table-presets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { page_key?: string; custom_kpi?: string; view?: string; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const pageKey = body.page_key;
  const kpi = (body.custom_kpi || "").trim();
  const view = body.view || "table";
  if (!pageKey || !kpi) return NextResponse.json({ error: "KPI personnalisé requis" }, { status: 400 });

  const persona = getAgentPersona(PAGE_AGENT_KEY[pageKey]);
  const client = new Anthropic({ apiKey: anthropicKey });

  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
    `Tu construis une table de données à partir du KPI décrit par l'utilisateur. ` +
    `IMPÉRATIF DE FIABILITÉ : n'utilise QUE ce catalogue canonique — ${CANONICAL_DOC} ` +
    `Traduis le besoin vers la combinaison entité/dimension/mesure/champ la plus proche et 100 % calculable. ` +
    `Si le besoin implique un montant en euros, mets unit_mode=currency ; sinon count. ` +
    `Pour le titre : REPRENDS fidèlement le KPI écrit par l'utilisateur, en le peaufinant seulement si besoin ` +
    `(orthographe, concision) — ne change pas son sens ni son intention. Réponds uniquement via l'outil.`;

  let spec: AggregateSpec | null = null;
  // Le titre part TOUJOURS du KPI écrit par l'utilisateur ; l'agent ne fait que
  // le peaufiner à défaut (si l'utilisateur n'a rien saisi).
  const userTitle = body.title?.trim();
  let title = userTitle || kpi;
  let unitMode = "count";

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
    if (!toolUse) return NextResponse.json({ error: "L'agent n'a pas pu interpréter ce KPI." }, { status: 422 });
    const inp = toolUse.input as {
      title?: string; entity?: string; groupBy?: string; measure?: string; field?: string; unit_mode?: string;
    };
    // On garde le KPI écrit par l'utilisateur ; la version agent n'est qu'un fallback.
    if (!userTitle && inp.title) title = inp.title;
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }

  // Validation déterministe : on rejette toute spec non calculable (fiabilité).
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const check = await computeAggregate(supabase, orgId, [], hubspotToken, spec);
  if (check.error) {
    return NextResponse.json(
      { error: `L'agent n'a pas trouvé de donnée fiable pour « ${kpi} ». Reformule ou choisis un KPI proposé.` },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("page_data_tables")
    .insert({
      organization_id: orgId,
      page_key: pageKey,
      title,
      entity: spec.entity,
      group_by: spec.groupBy,
      measure: spec.measure || "count",
      field: spec.field ?? null,
      unit_mode: unitMode,
      view,
      created_by: user.id,
    })
    .select("id, page_key, title, entity, group_by, measure, field, unit_mode, view, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data, agent: persona.name });
}
