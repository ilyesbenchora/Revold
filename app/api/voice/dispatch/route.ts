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
import { computeAggregate, DEAL_STATUS_LABELS } from "@/lib/ai/agents/tool-library";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

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

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));

/** Lignes {group,value} d'un agrégat (tableau vide si erreur). */
type AggRow = { group: string; value: number };
const aggRows = (r: Record<string, unknown>): AggRow[] => (Array.isArray(r.rows) ? (r.rows as AggRow[]) : []);
const bucketOf = (rows: AggRow[], name: string) => rows.find((r) => r.group === name)?.value ?? 0;
const sumOf = (rows: AggRow[]) => rows.reduce((s, r) => s + (r.value || 0), 0);

/**
 * RÉCAP VENTES en ENTONNOIR — l'action « fais-moi le point ventes » de la tour.
 * Chiffres 100 % déterministes (moteur d'agrégats), discours composé comme un
 * expert RevOps qui parle à son client : pipelines → deals en cours pondérés →
 * signatures → rapprochement avec l'encaissement. Sans signature, le pondéré
 * en cours devient le cœur du message.
 */
async function buildSalesRecap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
): Promise<string> {
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const agg = (input: Record<string, unknown>) =>
    computeAggregate(supabase, orgId, [], hubspotToken, input as never).catch(() => ({} as Record<string, unknown>));

  const [byPipeline, statusCount, statusSum, statusWeighted, outcomeSum, invoicesPaid] = await Promise.all([
    agg({ entity: "deals", groupBy: "pipeline", measure: "count" }),
    agg({ entity: "deals", groupBy: "status", measure: "count" }),
    agg({ entity: "deals", groupBy: "status", measure: "sum", field: "amount" }),
    agg({ entity: "deals", groupBy: "status", measure: "weighted", field: "amount" }),
    agg({ entity: "deals", groupBy: "outcome", measure: "sum", field: "amount" }),
    agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" }),
  ]);

  const pipelines = aggRows(byPipeline).filter((r) => r.value > 0);
  const openCount = bucketOf(aggRows(statusCount), DEAL_STATUS_LABELS.open);
  const openAmount = bucketOf(aggRows(statusSum), DEAL_STATUS_LABELS.open);
  const openWeighted = bucketOf(aggRows(statusWeighted), DEAL_STATUS_LABELS.open);
  const wonAmount = bucketOf(aggRows(outcomeSum), DEAL_STATUS_LABELS.won);
  const encaisse = sumOf(aggRows(invoicesPaid));

  if (pipelines.length === 0 && openCount === 0 && wonAmount === 0 && encaisse === 0) {
    return "Je n'ai pas encore de données de ventes exploitables — vérifie la connexion de ton CRM dans Intégrations.";
  }

  const parts: string[] = [];
  // 1. Le haut de l'entonnoir : pipelines et en-cours pondéré.
  const pipelineIntro =
    pipelines.length > 1
      ? `Sur tes ${pipelines.length} pipelines${pipelines.length <= 3 ? ` — ${pipelines.map((p) => p.group).join(", ")} —` : ","}`
      : "Sur ton pipeline,";
  if (openCount > 0) {
    parts.push(
      `${pipelineIntro} tu as ${openCount} deal${openCount > 1 ? "s" : ""} en cours pour ${eur(openAmount)} bruts. ` +
        `Pondéré par les probabilités de closing, ça représente ${eur(openWeighted)} de CA attendu.`,
    );
  } else {
    parts.push(`${pipelineIntro} aucun deal en cours pour l'instant — l'entonnoir est vide en haut, priorité à la prospection.`);
  }

  // 2. Les signatures, rapprochées de l'encaissement — ou le pondéré seul.
  if (wonAmount > 0) {
    parts.push(`Côté signatures : ${eur(wonAmount)} de CA signé.`);
    if (encaisse > 0) {
      const taux = Math.round((encaisse / wonAmount) * 100);
      const ecart = wonAmount - encaisse;
      parts.push(
        ecart > 0
          ? `En face, ${eur(encaisse)} sont réellement encaissés, soit ${taux} % du signé — il reste ${eur(ecart)} signés mais pas encore encaissés : c'est là que je mettrais la pression côté facturation.`
          : `Et l'encaissement suit : ${eur(encaisse)} encaissés — le signé est couvert, rien ne traîne côté facturation.`,
      );
    } else {
      parts.push("En face, aucun encaissement synchronisé : soit la facturation n'est pas connectée, soit rien n'est encore encaissé — à vérifier en priorité.");
    }
  } else {
    // Pas de signature : le pondéré en cours porte le message.
    parts.push(
      openWeighted > 0
        ? `Pas de signature pour l'instant : ton vrai actif, c'est le pipeline — ${eur(openWeighted)} pondérés à faire atterrir.`
        : "Pas de signature enregistrée pour l'instant.",
    );
    if (encaisse > 0) parts.push(`À noter quand même ${eur(encaisse)} encaissés côté facturation, sans deal signé rapproché en face.`);
  }

  return parts.join(" ");
}

type Supa = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const mkAgg = (supabase: Supa, orgId: string, hubspotToken: string | null) =>
  (input: Record<string, unknown>) =>
    computeAggregate(supabase, orgId, [], hubspotToken, input as never).catch(() => ({} as Record<string, unknown>));

/** Récap MARKETING : le tunnel contacts → MQL → SQL → opportunités. */
async function buildMarketingRecap(supabase: Supa, orgId: string): Promise<string> {
  const agg = mkAgg(supabase, orgId, await getHubSpotToken(supabase, orgId));
  const [mqlRows, sqlRows, statusCount] = await Promise.all([
    agg({ entity: "contacts", groupBy: "mql", measure: "count" }),
    agg({ entity: "contacts", groupBy: "sql", measure: "count" }),
    agg({ entity: "deals", groupBy: "status", measure: "count" }),
  ]);
  const total = sumOf(aggRows(mqlRows));
  if (total === 0) return "Je n'ai pas encore de contacts synchronisés — vérifie la connexion de ton CRM dans Intégrations.";
  const mql = bucketOf(aggRows(mqlRows), "MQL");
  const sql = bucketOf(aggRows(sqlRows), "SQL");
  const open = bucketOf(aggRows(statusCount), DEAL_STATUS_LABELS.open);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const parts = [
    `Ton tunnel marketing, de haut en bas : ${total.toLocaleString("fr-FR")} contacts dans la base, dont ${mql.toLocaleString("fr-FR")} qualifiés marketing — ${pct(mql, total)} % — et ${sql.toLocaleString("fr-FR")} qualifiés ventes, soit ${pct(sql, total)} %.`,
  ];
  if (mql > 0) parts.push(`La conversion MQL vers SQL est à ${pct(sql, mql)} % — c'est LE ratio à surveiller entre marketing et ventes.`);
  parts.push(
    open > 0
      ? `En sortie de tunnel, ${open} opportunité${open > 1 ? "s" : ""} en cours chez les ventes.`
      : "En sortie de tunnel, aucune opportunité en cours : le tunnel ne pousse rien aux ventes en ce moment.",
  );
  return parts.join(" ");
}

/** Récap FACTURATION (finance) : l'entonnoir cash — émis → encaissé → reste dû, + MRR. */
async function buildFinanceRecap(supabase: Supa, orgId: string): Promise<string> {
  const agg = mkAgg(supabase, orgId, await getHubSpotToken(supabase, orgId));
  const [countRows, totalRows, paidRows, dueRows, mrrRows] = await Promise.all([
    agg({ entity: "invoices", groupBy: "status", measure: "count" }),
    agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" }),
    agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" }),
    agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due" }),
    agg({ entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr" }),
  ]);
  const nb = sumOf(aggRows(countRows));
  const emis = sumOf(aggRows(totalRows));
  const paid = sumOf(aggRows(paidRows));
  const due = sumOf(aggRows(dueRows));
  const mrr = bucketOf(aggRows(mrrRows), "active");
  if (nb === 0 && mrr === 0) return "Aucune facture ni abonnement synchronisé — connecte ton outil de facturation dans Intégrations.";
  const parts: string[] = [];
  if (nb > 0) {
    parts.push(`L'entonnoir cash : ${nb.toLocaleString("fr-FR")} factures émises pour ${eur(emis)}.`);
    parts.push(
      paid > 0
        ? `Là-dessus, ${eur(paid)} sont encaissés — ${emis > 0 ? Math.round((paid / emis) * 100) : 0} % de l'émis.`
        : "Rien d'encaissé pour l'instant sur ces factures.",
    );
    parts.push(
      due > 0
        ? `Il reste ${eur(due)} dehors : c'est ton cash à aller chercher, relances en tête.`
        : "Aucun reste dû — le recouvrement est propre.",
    );
  }
  if (mrr > 0) parts.push(`Et en récurrent, ${eur(mrr)} de MRR actif, soit ${eur(mrr * 12)} annualisés.`);
  return parts.join(" ");
}

/** Récap SERVICE CLIENT : tickets + rétention des abonnements. */
async function buildCsRecap(supabase: Supa, orgId: string): Promise<string> {
  const agg = mkAgg(supabase, orgId, await getHubSpotToken(supabase, orgId));
  const [ticketRows, subsRows] = await Promise.all([
    agg({ entity: "tickets", groupBy: "status", measure: "count" }),
    agg({ entity: "subscriptions", groupBy: "status", measure: "count" }),
  ]);
  const tickets = aggRows(ticketRows);
  const nbTickets = sumOf(tickets);
  const subs = aggRows(subsRows);
  const active = bucketOf(subs, "active");
  const canceled = bucketOf(subs, "canceled") + bucketOf(subs, "expired");
  if (nbTickets === 0 && active === 0 && canceled === 0) {
    return "Pas encore d'outil support connecté ni d'abonnements synchronisés — le récap service client s'activera avec Zendesk, Intercom ou ta facturation.";
  }
  const parts: string[] = [];
  if (nbTickets > 0) {
    const top = [...tickets].sort((a, b) => b.value - a.value)[0];
    parts.push(`Côté support : ${nbTickets.toLocaleString("fr-FR")} tickets au total, majoritairement « ${top.group} » (${top.value}).`);
  }
  if (active > 0 || canceled > 0) {
    parts.push(`Côté rétention : ${active.toLocaleString("fr-FR")} abonnements actifs pour ${canceled.toLocaleString("fr-FR")} annulés ou expirés${active + canceled > 0 ? ` — soit ${Math.round((canceled / (active + canceled)) * 100)} % d'attrition sur la base` : ""}.`);
  }
  return parts.join(" ");
}

/** Récap DONNÉES / rapprochement : le socle du modèle, entité par entité. */
async function buildDataRecap(supabase: Supa, orgId: string): Promise<string> {
  const agg = mkAgg(supabase, orgId, await getHubSpotToken(supabase, orgId));
  const [companies, contacts, deals, invoices, tickets] = await Promise.all([
    agg({ entity: "companies", groupBy: "segment", measure: "count" }),
    agg({ entity: "contacts", groupBy: "mql", measure: "count" }),
    agg({ entity: "deals", groupBy: "status", measure: "count" }),
    agg({ entity: "invoices", groupBy: "status", measure: "count" }),
    agg({ entity: "tickets", groupBy: "status", measure: "count" }),
  ]);
  const counts: Array<[number, string]> = [
    [sumOf(aggRows(companies)), "entreprises"],
    [sumOf(aggRows(contacts)), "contacts"],
    [sumOf(aggRows(deals)), "deals"],
    [sumOf(aggRows(invoices)), "factures"],
    [sumOf(aggRows(tickets)), "tickets"],
  ];
  const present = counts.filter(([n]) => n > 0);
  if (present.length === 0) return "Le modèle de données est vide pour l'instant — connecte tes outils dans Intégrations.";
  return (
    `Ton modèle de données rapproche aujourd'hui ${present.map(([n, l]) => `${n.toLocaleString("fr-FR")} ${l}`).join(", ")}. ` +
    "Pour le taux de rapprochement précis outil par outil et les doublons, je peux te brancher l'agent données."
  );
}

/** Équipes récapitulables à la voix → builder + agent de suivi + libellé. */
const TEAM_RECAPS: Record<string, { label: string; agent: string; ask: string; build: (s: Supa, o: string) => Promise<string> }> = {
  sales: {
    label: "Récap ventes", agent: "performance",
    ask: "Approfondis mon récap de ventes en entonnoir : deals en cours par pipeline (bruts et pondérés), CA signé, rapprochement avec l'encaissement, et les 3 actions prioritaires pour accélérer.",
    build: buildSalesRecap,
  },
  marketing: {
    label: "Récap marketing", agent: "performance",
    ask: "Approfondis mon tunnel marketing : contacts, MQL, SQL, conversion par étape et par source, et les 3 leviers prioritaires.",
    build: buildMarketingRecap,
  },
  finance: {
    label: "Récap facturation", agent: "paiement-facturation",
    ask: "Approfondis mon entonnoir cash : factures émises, encaissées, reste dû par client, MRR, et les relances prioritaires.",
    build: buildFinanceRecap,
  },
  cs: {
    label: "Récap service client", agent: "service-client",
    ask: "Approfondis mon récap service client : tickets par statut, temps de traitement, churn et rétention des abonnements.",
    build: buildCsRecap,
  },
  data: {
    label: "Récap données", agent: "proprietes",
    ask: "Approfondis mon récap qualité de données : taux de rapprochement par outil, doublons, champs manquants et actions prioritaires.",
    build: buildDataRecap,
  },
};

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
        "1bis) « récap / bilan / point / résumé » d'une ÉQUIPE → team_recap avec la bonne équipe (JAMAIS quick_answer) : ventes/commerce → sales (entonnoir pipelines → signé → encaissé), marketing → marketing (tunnel contacts → MQL → SQL), facturation/tréso/cash → finance, support/service client/churn → cs, données/rapprochement/qualité → data. " +
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
          name: "team_recap",
          description:
            "Récap d'une équipe raconté comme un expert RevOps, en entonnoir : sales (pipelines → pondéré en cours → signé → encaissé), marketing (contacts → MQL → SQL → opportunités), finance (émis → encaissé → reste dû, MRR), cs (tickets + rétention), data (socle du modèle). À utiliser pour « récap/bilan/point <équipe> ».",
          input_schema: {
            type: "object",
            properties: {
              team: { type: "string", enum: Object.keys(TEAM_RECAPS) },
              say: { type: "string", description: "Intro orale courte (ex : « Je te fais le point ventes. »)." },
            },
            required: ["team"],
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
    } else if (tu.name === "team_recap") {
      // Récap d'équipe en entonnoir : chiffres déterministes + discours RevOps.
      const team = typeof inp.team === "string" && TEAM_RECAPS[inp.team] ? inp.team : "sales";
      const def = TEAM_RECAPS[team];
      const recap = await def.build(supabase, orgId);
      actions.push({
        type: "answer",
        label: def.label,
        value: null,
        formatted: null,
        say: `${say || `Je te fais le point.`} ${recap}`,
        followupAgentKey: def.agent,
        followupName: getAgentPersona(def.agent).name,
        followupAsk: def.ask,
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
