import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { runAgentTurn, type AgentMessage } from "@/lib/ai/agents/agent-runtime";
import { aggregateCanonical, listConnectedSources } from "@/lib/ai/agents/tool-library";
import { metricDictionaryDirective } from "@/lib/settings/metric-definitions";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { PAGE_AGENT_KEY } from "@/lib/reports/data-table-presets";
import { basePageKey } from "@/lib/kpi/tile-catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Tableau de bord CONVERSATIONNEL — POST { pageKey, question, history? }.
 * L'utilisateur pose une question en langage naturel SUR un tableau de bord ;
 * l'agent répond en recalculant les chiffres via le moteur déterministe
 * (aggregate_canonical — jamais un chiffre inventé), contextualisé par la
 * composition réelle du tableau (tuiles + tables et leurs specs).
 * Réponse : { text } — texte court, chiffres câblés.
 */

/**
 * Clés de page autorisées : tableaux de bord (tableau_bord, board_<id>) ET
 * pages de données (perf_ventes, audit_paiement_facturation…) — toutes les
 * pages de données sont des tableaux de bord conversationnels. Le charset est
 * borné ; les lectures restent scellées à l'organisation de l'utilisateur.
 */
const PAGE_KEY_RE = /^[a-z0-9_-]{3,64}$/i;

type TileRow = { title: string | null; forecast_type: string | null; agg_spec: Record<string, unknown> | null };
type TableRow = {
  title: string | null;
  entity: string | null;
  group_by: string | null;
  measure: string | null;
  field: string | null;
  view: string | null;
  pipeline: string | null;
};

/** Description compacte de la composition du tableau, injectée dans le system prompt. */
function describeComposition(tiles: TileRow[], tables: TableRow[]): string {
  const tileLines = tiles.map((t) => {
    const spec = t.agg_spec ?? {};
    const parts = [
      spec.entity && `entity=${spec.entity}`,
      spec.groupBy && `groupBy=${spec.groupBy}`,
      spec.measure && `measure=${spec.measure}`,
      spec.field && `field=${spec.field}`,
      spec.target && `ligne ciblée=« ${spec.target} »`,
      spec.percent_of_total === true && "en % du total",
      spec.pipeline && `pipeline=${spec.pipeline}`,
    ].filter(Boolean);
    return `- Tuile « ${t.title ?? "KPI"} »${t.forecast_type ? ` (recette ${t.forecast_type})` : parts.length ? ` (${parts.join(", ")})` : ""}`;
  });
  const tableLines = tables.map((t) => {
    const parts = [
      t.entity && `entity=${t.entity}`,
      t.group_by && `groupBy=${t.group_by}`,
      t.measure && `measure=${t.measure}`,
      t.field && `field=${t.field}`,
      t.pipeline && `pipeline=${t.pipeline}`,
    ].filter(Boolean);
    return `- ${t.view === "table" ? "Table" : "Graphique"} « ${t.title ?? "Sans titre"} » (${parts.join(", ")})`;
  });
  if (tileLines.length === 0 && tableLines.length === 0) {
    return "Le tableau est encore vide (aucune tuile ni table).";
  }
  return [...tileLines, ...tableLines].join("\n");
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "Agent indisponible (clé API absente)." }, { status: 500 });
  }

  let body: { pageKey?: string; question?: string; history?: Array<{ role?: string; content?: string }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const pageKey = typeof body.pageKey === "string" && PAGE_KEY_RE.test(body.pageKey) ? body.pageKey : null;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
  if (!pageKey) return NextResponse.json({ error: "pageKey invalide" }, { status: 400 });
  if (!question) return NextResponse.json({ error: "question requise" }, { status: 400 });

  // ── Composition réelle du tableau : contexte de la conversation ──
  let tiles: TileRow[] = [];
  let tables: TableRow[] = [];
  try {
    const { data } = await supabase
      .from("page_tiles")
      .select("title, forecast_type, agg_spec")
      .eq("organization_id", orgId)
      .eq("page_key", pageKey)
      .eq("kind", "kpi")
      .limit(30);
    tiles = (data ?? []) as TileRow[];
  } catch { /* table absente → tableau vide */ }
  try {
    const { data } = await supabase
      .from("page_data_tables")
      .select("title, entity, group_by, measure, field, view, pipeline")
      .eq("organization_id", orgId)
      .eq("page_key", pageKey)
      .limit(30);
    tables = (data ?? []) as TableRow[];
  } catch { /* table absente → tableau vide */ }

  // ── L'agent ADÉQUAT de la page : le même expert que son funnel de câblage
  // (Ventes/Marketing → Chloé Performance, Trésorerie → Inès, Service client →
  // Hugo, Rapprochement données → Karim ; tableaux créés → agent Revold neutre).
  const agentKey = PAGE_AGENT_KEY[basePageKey(pageKey)] ?? null;
  const persona = getAgentPersona(agentKey);

  const system =
    `Tu es ${persona.name}, ${persona.role} chez Revold, en conversation SUR un tableau de bord précis de l'utilisateur (PME/ETI française). ` +
    "Tu réponds à ses questions chiffrées en RECALCULANT les données via tes outils — JAMAIS un chiffre inventé, estimé ou de mémoire : " +
    "chaque valeur citée vient d'un appel aggregate_canonical (respecte les filtres pipeline/target des blocs concernés quand la question porte sur eux). " +
    "Si une donnée n'existe pas ou n'est pas calculable, dis-le simplement. " +
    "Réponds en FRANÇAIS, tutoiement, 2 à 6 phrases maximum, direct et concret : le chiffre d'abord, la lecture ensuite (tendance, comparaison, point d'attention). " +
    "Formate les montants proprement (ex : 124 500 €, 1,2 M€), sans caractères spéciaux inhabituels ; pas de listes à puces sauf nécessité. " +
    "\n\nComposition ACTUELLE du tableau (les blocs que l'utilisateur a sous les yeux — sers-t'en pour interpréter sa question) :\n" +
    describeComposition(tiles, tables) +
    // Dictionnaire des métriques de l'org : ses définitions maison font foi.
    (await metricDictionaryDirective(supabase, orgId));

  // Historique court (suivis « et en mars ? ») — 6 messages max, le dernier est la question.
  const history: AgentMessage[] = (Array.isArray(body.history) ? body.history : [])
    .filter((m): m is { role: string; content: string } =>
      !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && !!m.content.trim())
    .slice(-6)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  const messages: AgentMessage[] = [...history, { role: "user", content: question }];

  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const client = new Anthropic({ apiKey: anthropicKey });

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: [aggregateCanonical, listConnectedSources],
      messages,
      ctx: { supabase, orgId, hubspotToken, sources: [] },
      maxSteps: 6,
    });
    return NextResponse.json({
      text: result.text || "Je n'ai pas pu formuler de réponse — reformule ta question.",
      agent: { name: persona.name, role: persona.role },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Réponse impossible — réessaie." },
      { status: 500 },
    );
  }
}
