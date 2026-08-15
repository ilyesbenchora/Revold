import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { AGENTS } from "@/lib/ai/agents/registry";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { kpisByTeam, type KpiDef } from "@/lib/alerts/kpi-catalog";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Catalogue KPI unique (id → def) — réponses directes + créations vocales. */
const KPI_DEFS: Map<string, KpiDef> = new Map();
for (const defs of Object.values(kpisByTeam)) for (const d of defs) if (!KPI_DEFS.has(d.id)) KPI_DEFS.set(d.id, d);
const KPI_IDS = [...KPI_DEFS.keys()];
const KPI_DOC = [...KPI_DEFS.values()].map((d) => `${d.id} = ${d.label}`).join(" ; ");

/** Agent naturel pour « creuser » un KPI répondu en direct. */
const KPI_FOLLOWUP_AGENT: Record<string, string> = { sales: "performance", marketing: "performance", data: "proprietes" };

/** Pages navigables à la voix (cible → route + libellé). */
const NAV_TARGETS: Record<string, { href: string; label: string }> = {
  dashboard: { href: "/dashboard", label: "le tableau de bord" },
  "equipe-ia": { href: "/dashboard/audit", label: "Mon équipe IA" },
  "performances-ventes": { href: "/dashboard/performances/commerciale", label: "Performances Ventes" },
  "performances-marketing": { href: "/dashboard/performances/marketing", label: "Performances Marketing" },
  tresorerie: { href: "/dashboard/audit/paiement-facturation", label: "la Trésorerie" },
  "service-client": { href: "/dashboard/audit/service-client", label: "le Service Client" },
  "rapprochement-donnees": { href: "/dashboard/donnees", label: "Rapprochement données" },
  appels: { href: "/dashboard/appels", label: "les Appels" },
  "mes-alertes": { href: "/dashboard/mes-alertes", label: "Mes alertes" },
  actions: { href: "/dashboard/mes-alertes/actions", label: "les Actions" },
  objectifs: { href: "/dashboard/mes-alertes/objectifs", label: "les Objectifs" },
  rapports: { href: "/dashboard/rapports", label: "les Rapports" },
  seances: { href: "/dashboard/mes-alertes/seances", label: "les Séances" },
  enrichissement: { href: "/dashboard/enrichissement", label: "l'Enrichissement" },
  "parametres-integrations": { href: "/dashboard/parametres/integrations", label: "Paramètres → Intégrations" },
  "modele-donnees": { href: "/dashboard/parametres/modele-donnees", label: "le Modèle de données" },
};

/** Route de la page portant un rapport sauvegardé (page_data_tables.page_key). */
const REPORT_PAGE_ROUTES: Record<string, string> = {
  perf_ventes: "/dashboard/performances/commerciale",
  perf_marketing: "/dashboard/performances/marketing",
  audit_service_client: "/dashboard/audit/service-client",
  audit_paiement_facturation: "/dashboard/audit/paiement-facturation",
  audit_donnees: "/dashboard/donnees",
};

function fmtKpi(v: number, unit: KpiDef["defaultUnit"]): string {
  if (unit === "currency") return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toLocaleString("fr-FR")} %`;
  return v.toLocaleString("fr-FR");
}

type Action = Record<string, unknown> & { type: string; say: string };

/**
 * Tour de contrôle vocale Revold : route une demande dictée vers la bonne
 * ACTION — briefer un agent (chat pré-exécuté), répondre directement à
 * une question KPI simple, créer une alerte ou un objectif (validés par
 * l'utilisateur), naviguer vers une page ou un rapport, lire le brief du jour.
 * Plusieurs demandes dans une phrase → plusieurs actions (file côté client).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Tour de contrôle vocale : réservée aux plans Business et Scale.
  const plan = await getOrgPlan(supabase, orgId);
  if (featureLocked(plan, "voice_control_tower")) {
    return NextResponse.json({ error: "La tour de contrôle vocale est disponible à partir du plan Business." }, { status: 403 });
  }

  let body: { transcript?: string; history?: Array<{ q?: string; outcome?: string }>; disabled?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const transcript = (body.transcript || "").trim().slice(0, 600);
  if (!transcript) return NextResponse.json({ error: "Transcription vide" }, { status: 400 });
  // Personnalisation (Paramètres → Tour de contrôle) : fonctionnalités coupées
  // par l'utilisateur — les outils correspondants ne sont pas proposés au
  // routeur. dispatch et clarify restent toujours actifs.
  const disabled = new Set(
    (Array.isArray(body.disabled) ? body.disabled : [])
      .filter((t): t is string => typeof t === "string" && t !== "dispatch" && t !== "clarify"),
  );
  // Mémoire de contexte : les derniers échanges permettent les enchaînements
  // (« et par rapport au mois dernier ? ») sans répéter le sujet.
  const history = (body.history ?? [])
    .filter((h) => typeof h?.q === "string" && h.q)
    .slice(-3)
    .map((h) => `- « ${String(h.q).slice(0, 200)} » → ${String(h.outcome ?? "").slice(0, 160)}`)
    .join("\n");

  const { key: anthropicKey, reason } = getAnthropicKey();
  if (!anthropicKey) return NextResponse.json({ error: reason ?? "ANTHROPIC_API_KEY manquante" }, { status: 500 });

  const agents = Object.values(AGENTS);
  const roster = agents
    .map((a) => `- ${a.key} : ${a.label} (${getAgentPersona(a.key).name}) — ${a.tagline}`)
    .join("\n");

  const client = new Anthropic({ apiKey: anthropicKey });
  let resp: Anthropic.Message;
  try {
    resp = await client.messages.create({
      // Routage pur : le modèle rapide suffit (latence vocale).
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system:
        "Tu es la tour de contrôle vocale de Revold (Revenue Intelligence). L'utilisateur dicte une demande ; tu choisis la ou les ACTIONS. " +
        "RÈGLES DE CHOIX : " +
        "1) Question SIMPLE sur un KPI du catalogue (« combien / c'est quoi mon X ») → quick_answer (réponse immédiate, sans navigation). " +
        "2) Demande d'analyse, de diagnostic, de rapport, de séance de travail → dispatch vers l'agent pertinent, avec la demande reformulée en instruction claire et fidèle. " +
        "3) « préviens-moi si… / alerte quand… » → create_alert. « objectif de… » → create_objective. " +
        "4) « ouvre / montre / va sur… » une page ou un rapport → navigate. " +
        "5) « mon brief / résumé du jour / quoi de neuf » → daily_brief. " +
        "6) Plusieurs demandes dans la même phrase → PLUSIEURS appels d'outils, un par demande. " +
        "7) Incompréhensible ou hors sujet → clarify. " +
        `Catalogue KPI (forecast_type = libellé) : ${KPI_DOC}. ` +
        `Roster des agents :\n${roster}\n` +
        (history ? `Échanges précédents (contexte pour les enchaînements) :\n${history}\n` : "") +
        "Le champ say est toujours une phrase orale TRÈS courte, style tour de contrôle. Réponds uniquement via des outils.",
      tools: ([
        {
          name: "dispatch",
          description: "Briefe un agent : redirection vers son chat avec la demande exécutée.",
          input_schema: {
            type: "object",
            properties: {
              agent_key: { type: "string", enum: agents.map((a) => a.key) },
              request: { type: "string", description: "Demande reformulée en instruction claire (français), exécutée telle quelle." },
              say: { type: "string" },
            },
            required: ["agent_key", "request", "say"],
          },
        },
        {
          name: "quick_answer",
          description: "Répond immédiatement à une question simple sur un KPI du catalogue (valeur actuelle).",
          input_schema: {
            type: "object",
            properties: { forecast_type: { type: "string", enum: KPI_IDS } },
            required: ["forecast_type"],
          },
        },
        {
          name: "create_alert",
          description: "Prépare la création d'une alerte de suivi (l'utilisateur valide avant création).",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titre court de l'alerte." },
              forecast_type: { type: "string", enum: KPI_IDS },
              threshold: { type: "number" },
              direction: { type: "string", enum: ["above", "below"] },
              team: { type: "string", enum: ["sales", "marketing", "cs", "revops", "ops"] },
              say: { type: "string", description: "Confirmation orale se terminant par une demande de validation." },
            },
            required: ["title", "forecast_type", "threshold", "direction", "team", "say"],
          },
        },
        {
          name: "create_objective",
          description: "Prépare la création d'un objectif chiffré (l'utilisateur valide avant création).",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              forecast_type: { type: "string", enum: KPI_IDS, description: "KPI auto-suivi si la cible correspond à un KPI du catalogue. Omettre sinon." },
              target: { type: "number" },
              direction: { type: "string", enum: ["above", "below"] },
              team: { type: "string", enum: ["sales", "marketing", "csm", "finance", "revops"] },
              date_to: { type: "string", description: "Échéance YYYY-MM-DD si mentionnée. Omettre sinon." },
              say: { type: "string", description: "Confirmation orale se terminant par une demande de validation." },
            },
            required: ["title", "target", "direction", "team", "say"],
          },
        },
        {
          name: "navigate",
          description: "Ouvre une page de la plateforme, ou un rapport sauvegardé par son titre.",
          input_schema: {
            type: "object",
            properties: {
              target: { type: "string", enum: Object.keys(NAV_TARGETS), description: "Page cible. Omettre si report_title est donné." },
              report_title: { type: "string", description: "Titre (approximatif) d'un rapport sauvegardé à ouvrir. Omettre pour une page." },
              say: { type: "string" },
            },
            required: ["say"],
          },
        },
        {
          name: "daily_brief",
          description: "Lit le brief du jour (alertes, objectifs, syncs, agenda).",
          input_schema: { type: "object", properties: { say: { type: "string", description: "Intro orale courte (ex : « Voilà ton brief. »)." } } },
        },
        {
          name: "clarify",
          description: "Demande incompréhensible ou hors sujet : demander à reformuler.",
          input_schema: { type: "object", properties: { say: { type: "string" } }, required: ["say"] },
        },
      ] as Anthropic.Tool[]).filter((t) => !disabled.has(t.name)),
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: `Demande dictée : « ${transcript} »` }],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur de routage" }, { status: 500 });
  }

  const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").slice(0, 4);
  if (toolUses.length === 0) return NextResponse.json({ error: "Routage impossible" }, { status: 422 });

  const actions: Action[] = [];
  for (const tu of toolUses) {
    const inp = tu.input as Record<string, unknown>;
    const say = typeof inp.say === "string" ? inp.say.trim() : "";

    if (tu.name === "clarify") {
      actions.push({ type: "clarify", say: say || "Je n'ai pas compris — reformule ta demande ?" });
    } else if (tu.name === "daily_brief") {
      actions.push({ type: "brief", say: say || "Voilà ton brief." });
    } else if (tu.name === "dispatch") {
      const agent = typeof inp.agent_key === "string" ? AGENTS[inp.agent_key] : null;
      if (!agent) continue;
      const persona = getAgentPersona(agent.key);
      actions.push({
        type: "agent",
        agentKey: agent.key,
        agentLabel: agent.label,
        personaName: persona.name,
        request: (typeof inp.request === "string" && inp.request.trim()) || transcript,
        say: say || `Je briefe ${persona.name}.`,
      });
    } else if (tu.name === "quick_answer") {
      // Réponse DIRECTE : valeur réelle calculée maintenant (moteur des alertes).
      const ft = typeof inp.forecast_type === "string" ? inp.forecast_type : "";
      const def = KPI_DEFS.get(ft);
      if (!def) continue;
      let value: number | null = null;
      try { value = await resolveKpiValue(supabase, orgId, ft, {}); } catch {}
      const followKey = KPI_FOLLOWUP_AGENT[def.category] ?? "performance";
      actions.push({
        type: "answer",
        label: def.label,
        value,
        formatted: value != null ? fmtKpi(value, def.defaultUnit) : null,
        say: value != null ? `${def.label} : ${fmtKpi(value, def.defaultUnit)}.` : `${def.label} : pas de valeur calculable pour l'instant.`,
        followupAgentKey: followKey,
        followupName: getAgentPersona(followKey).name,
        followupAsk: `Analyse en détail mon ${def.label.toLowerCase()} : niveau actuel, tendance et leviers d'amélioration.`,
      });
    } else if (tu.name === "create_alert") {
      const ft = typeof inp.forecast_type === "string" && KPI_DEFS.has(inp.forecast_type) ? inp.forecast_type : null;
      if (!ft || typeof inp.threshold !== "number") continue;
      const def = KPI_DEFS.get(ft)!;
      actions.push({
        type: "create_alert",
        payload: {
          title: (typeof inp.title === "string" && inp.title.trim()) || `${def.label} : seuil ${inp.threshold}`,
          forecast_type: ft,
          threshold: inp.threshold,
          direction: inp.direction === "below" ? "below" : "above",
          team: typeof inp.team === "string" ? inp.team : "revops",
          unit_mode: def.defaultUnit,
        },
        summary: `Alerte « ${def.label} » ${inp.direction === "below" ? "sous" : "au-dessus de"} ${fmtKpi(Number(inp.threshold), def.defaultUnit)}`,
        say: say || `Je prépare l'alerte sur ${def.label}, seuil ${fmtKpi(Number(inp.threshold), def.defaultUnit)} — tu valides ?`,
      });
    } else if (tu.name === "create_objective") {
      if (typeof inp.target !== "number") continue;
      const ft = typeof inp.forecast_type === "string" && KPI_DEFS.has(inp.forecast_type) ? inp.forecast_type : null;
      const unit = ft ? KPI_DEFS.get(ft)!.defaultUnit : "count";
      const dateTo = typeof inp.date_to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(inp.date_to) ? inp.date_to : null;
      actions.push({
        type: "create_objective",
        payload: {
          title: (typeof inp.title === "string" && inp.title.trim()) || `Objectif ${inp.target}`,
          forecast_type: ft,
          target: inp.target,
          direction: inp.direction === "below" ? "below" : "above",
          team: typeof inp.team === "string" ? inp.team : "revops",
          unit_mode: unit,
          date_to: dateTo,
        },
        summary: `Objectif « ${(typeof inp.title === "string" && inp.title) || inp.target} » cible ${fmtKpi(Number(inp.target), unit as KpiDef["defaultUnit"])}${dateTo ? ` d'ici le ${dateTo}` : ""}`,
        say: say || "Je prépare l'objectif — tu valides ?",
      });
    } else if (tu.name === "navigate") {
      const reportTitle = typeof inp.report_title === "string" ? inp.report_title.trim() : "";
      if (reportTitle) {
        // Rapport sauvegardé : matching souple sur le titre, ancre sur sa carte.
        const { data } = await supabase
          .from("page_data_tables")
          .select("id, title, page_key")
          .eq("organization_id", orgId)
          .ilike("title", `%${reportTitle.replace(/[%_]/g, "")}%`)
          .limit(1)
          .maybeSingle();
        if (data && REPORT_PAGE_ROUTES[data.page_key as string]) {
          actions.push({
            type: "navigate",
            href: `${REPORT_PAGE_ROUTES[data.page_key as string]}#table-${data.id}`,
            label: `le rapport « ${data.title} »`,
            say: say || `J'ouvre le rapport ${data.title}.`,
          });
          continue;
        }
        actions.push({ type: "clarify", say: `Je ne trouve pas de rapport « ${reportTitle} » — reformule son titre ?` });
        continue;
      }
      const target = typeof inp.target === "string" ? NAV_TARGETS[inp.target] : null;
      if (!target) continue;
      actions.push({ type: "navigate", href: target.href, label: target.label, say: say || `J'ouvre ${target.label}.` });
    }
  }

  if (actions.length === 0) return NextResponse.json({ error: "Routage impossible" }, { status: 422 });
  return NextResponse.json({ actions });
}
