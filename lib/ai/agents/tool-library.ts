import type { AgentTool, AgentContext } from "./agent-runtime";
import { fetchPaiementFacturationFor } from "@/lib/audit/paiement-facturation-data";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { fetchDealsPipelines } from "@/lib/integrations/hubspot-snapshot";
import { fetchAdsPerformance } from "@/lib/integrations/sources/ads";

/**
 * Performance publicité & web (Google Analytics/Ads, Meta Ads, LinkedIn Ads) sur
 * 30 jours pour les régies connectées. Sert à croiser la dépense marketing avec
 * le revenu réel (ROAS jusqu'à l'encaissement).
 */
export const getAdsPerformance: AgentTool = {
  def: {
    name: "get_ads_performance",
    description:
      "Récupère les métriques (30 derniers jours) des régies publicité/web connectées : dépense, impressions, clics, conversions, par plateforme (Google Analytics, Google Ads, Meta Ads, LinkedIn Ads). À croiser avec le pipeline et le revenu encaissé pour évaluer le ROAS réel.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const metrics = await fetchAdsPerformance(ctx.supabase, ctx.orgId);
    if (metrics.length === 0) {
      return { connected: false, message: "Aucune régie publicité/web connectée (Google Analytics/Ads, Meta, LinkedIn)." };
    }
    const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
    const totalConv = metrics.reduce((s, m) => s + m.conversions, 0);
    return {
      connected: true,
      period: "30 derniers jours",
      byPlatform: metrics,
      totals: { spend: Math.round(totalSpend), conversions: Math.round(totalConv), costPerConversion: totalConv > 0 ? Math.round(totalSpend / totalConv) : null },
    };
  },
};

/**
 * Bibliothèque de tools réutilisables par les agents experts.
 *
 * Chaque tool APPELLE la couche déterministe existante (fetchers, tables
 * canoniques, KPIs) — les agents n'inventent aucun chiffre. Le runtime encadre
 * chaque exécution d'un try/catch, donc un tool qui échoue renvoie proprement
 * une erreur à l'agent sans casser le tour.
 */

function companyName(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as { name?: string })?.name ?? null;
  return (rel as { name?: string }).name ?? null;
}
function daysOverdue(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const diff = Date.now() - new Date(dueAt).getTime();
  return diff > 0 ? Math.round(diff / 86_400_000) : 0;
}
function billingSourceFilter(sources: string[]): string[] | null {
  const billing = sources.filter((s) => s !== "hubspot");
  return billing.length > 0 ? billing : null;
}

/** Clés "YYYY-MM" des N derniers mois (mois courant inclus, ordre chronologique). */
function monthKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** KPI snapshot matérialisé (kpi_snapshots) — vue chiffrée transverse. */
export const getKpiSnapshot: AgentTool = {
  def: {
    name: "get_kpi_snapshot",
    description:
      "Renvoie le dernier snapshot KPI matérialisé de l'org : closing rate, couverture pipeline, cycle de vente, forecast pondéré, vélocité, MQL→SQL, vélocité leads, fuite du tunnel, deals inactifs, complétude données, stagnation, doublons/orphelins contacts, activités par deal, et les 3 scores moteur (ventes, marketing, crm_ops). À appeler pour toute analyse de performance chiffrée.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data } = await ctx.supabase
      .from("kpi_snapshots")
      .select("*")
      .eq("organization_id", ctx.orgId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { hasData: false, note: "Aucun snapshot KPI. Lancer une synchro / un calcul KPI." };
    const k = data as Record<string, unknown>;
    const pick = (key: string) => k[key] ?? null;
    return {
      hasData: true,
      snapshotDate: pick("snapshot_date"),
      closingRate: pick("closing_rate"),
      pipelineCoverage: pick("pipeline_coverage"),
      salesCycleDays: pick("sales_cycle_days"),
      weightedForecast: pick("weighted_forecast"),
      dealVelocity: pick("deal_velocity"),
      mqlToSqlRate: pick("mql_to_sql_rate"),
      leadVelocityRate: pick("lead_velocity_rate"),
      funnelLeakageRate: pick("funnel_leakage_rate"),
      inactiveDealsPct: pick("inactive_deals_pct"),
      dataCompleteness: pick("data_completeness"),
      dealStagnationRate: pick("deal_stagnation_rate"),
      duplicateContactsPct: pick("duplicate_contacts_pct"),
      orphanContactsPct: pick("orphan_contacts_pct"),
      activitiesPerDeal: pick("activities_per_deal"),
      salesScore: pick("sales_score"),
      marketingScore: pick("marketing_score"),
      crmOpsScore: pick("crm_ops_score"),
    };
  },
};

/** Qualité de données dérivée du snapshot KPI. */
export const getDataQuality: AgentTool = {
  def: {
    name: "get_data_quality",
    description:
      "Renvoie les indicateurs de qualité et d'hygiène de la donnée : complétude, % doublons de contacts, % contacts orphelins, % deals inactifs, taux de stagnation des deals. À utiliser pour auditer la fiabilité de la base CRM.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data } = await ctx.supabase
      .from("kpi_snapshots")
      .select("data_completeness, duplicate_contacts_pct, orphan_contacts_pct, inactive_deals_pct, deal_stagnation_rate, snapshot_date")
      .eq("organization_id", ctx.orgId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { hasData: false, note: "Aucun snapshot KPI disponible." };
    return { hasData: true, ...data };
  },
};

/** Volumétrie cross-source depuis les tables canoniques. */
export const getCanonicalCounts: AgentTool = {
  def: {
    name: "get_canonical_counts",
    description:
      "Renvoie les volumes réconciliés cross-source de l'org : nombre d'entreprises, contacts, deals, factures, abonnements actifs, paiements, tickets. Donne une vue de la couverture des données par source.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const base = (table: string) =>
      ctx.supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", ctx.orgId);
    const n = (r: { count: number | null }) => r.count ?? 0;
    const [companies, contacts, deals, invoices, activeSubs, payments, tickets] = await Promise.all([
      base("companies"),
      base("contacts"),
      base("deals"),
      base("invoices"),
      base("subscriptions").eq("status", "active"),
      base("payments"),
      base("tickets"),
    ]);
    return {
      companies: n(companies),
      contacts: n(contacts),
      deals: n(deals),
      invoices: n(invoices),
      activeSubscriptions: n(activeSubs),
      payments: n(payments),
      tickets: n(tickets),
    };
  },
};

/** Série temporelle des deals : créés par mois + gagnés par mois (sur les tables canoniques). */
export const getDealsTimeseries: AgentTool = {
  def: {
    name: "get_deals_timeseries",
    description:
      "Ventile les deals par mois à partir de la table canonique deals (synchronisée) : nombre et montant des deals CRÉÉS par mois (sur created_date) et des deals GAGNÉS par mois (sur close_date, étape closed_won). Utilise pour tout graphique/série temporelle de transactions par mois, tendance de création, ou revenue signé par mois. Ne dépend PAS du snapshot KPI.",
    input_schema: {
      type: "object",
      properties: { months: { type: "integer", description: "Nombre de mois d'historique (défaut 6, max 24)." } },
    },
  },
  run: async (input, ctx: AgentContext) => {
    const months = Math.min(Math.max(Number(input.months) || 6, 1), 24);
    const { data, error } = await ctx.supabase
      .from("deals")
      .select("created_date, close_date, amount, pipeline_stages(is_closed_won)")
      .eq("organization_id", ctx.orgId)
      .limit(8000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0) return { hasData: false, note: "Aucun deal dans la table canonique." };
    const keys = monthKeys(months);
    const created: Record<string, { deals: number; amount: number }> = {};
    const won: Record<string, { deals: number; amount: number }> = {};
    for (const k of keys) {
      created[k] = { deals: 0, amount: 0 };
      won[k] = { deals: 0, amount: 0 };
    }
    for (const r of rows) {
      const amount = Number(r.amount) || 0;
      const cm = String(r.created_date ?? "").slice(0, 7);
      if (created[cm]) {
        created[cm].deals++;
        created[cm].amount += amount;
      }
      const st = r.pipeline_stages;
      const stage = (Array.isArray(st) ? st[0] : st) as { is_closed_won?: boolean } | null;
      if (stage?.is_closed_won && r.close_date) {
        const wm = String(r.close_date).slice(0, 7);
        if (won[wm]) {
          won[wm].deals++;
          won[wm].amount += amount;
        }
      }
    }
    return {
      hasData: true,
      months,
      totalDeals: rows.length,
      createdByMonth: keys.map((k) => ({ month: k, deals: created[k].deals, amount: Math.round(created[k].amount) })),
      wonByMonth: keys.map((k) => ({ month: k, deals: won[k].deals, amount: Math.round(won[k].amount) })),
    };
  },
};

/** Répartition du pipeline par étape (count, montant, montant pondéré). */
export const getPipelineByStage: AgentTool = {
  def: {
    name: "get_pipeline_by_stage",
    description:
      "Répartit les deals par étape (count, montant, montant pondéré). Lit la table canonique et résout automatiquement les VRAIS noms d'étapes via HubSpot quand la synchro n'a pas mappé le dealstage — plus de masse « Sans étape ». Équivalent tous-pipelines confondus ; pour le détail par pipeline nommé sur une fenêtre récente, utilise get_pipeline_stage_breakdown.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data, error } = await ctx.supabase
      .from("deals")
      .select("amount, stage_external_id, pipeline_stages(name, position, probability, is_closed_won, is_closed_lost)")
      .eq("organization_id", ctx.orgId)
      .limit(8000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0) return { hasData: false, note: "Aucun deal dans la table canonique." };
    // Résolution fiable des noms d'étapes : canonique si mappé, sinon HubSpot direct.
    const stageMap = await resolveStageMap(ctx.hubspotToken);
    const byStage: Record<string, { position: number; deals: number; amount: number; weighted: number; closed: boolean }> = {};
    for (const r of rows) {
      const st = (Array.isArray(r.pipeline_stages) ? r.pipeline_stages[0] : r.pipeline_stages) as
        | { name?: string; position?: number; probability?: number; is_closed_won?: boolean; is_closed_lost?: boolean }
        | null;
      const hs = typeof r.stage_external_id === "string" ? stageMap.get(r.stage_external_id) : undefined;
      const name = st?.name ?? hs?.label ?? "Sans étape";
      const position = Number(st?.position) || hs?.position || 99;
      const probPct = Number(st?.probability) || hs?.probability || 0;
      const closed = !!(st?.is_closed_won || st?.is_closed_lost) || !!(hs?.closedWon || hs?.closedLost);
      const prob = probPct / 100;
      const e = (byStage[name] ??= { position, deals: 0, amount: 0, weighted: 0, closed });
      const a = Number(r.amount) || 0;
      e.deals++;
      e.amount += a;
      e.weighted += a * prob;
    }
    const stages = Object.entries(byStage)
      .map(([name, e]) => ({
        stage: name,
        deals: e.deals,
        amount: Math.round(e.amount),
        weightedAmount: Math.round(e.weighted),
        closed: e.closed,
      }))
      .sort((a, b) => byStage[a.stage].position - byStage[b.stage].position);
    return {
      hasData: true,
      stages,
      openPipelineAmount: Math.round(stages.filter((s) => !s.closed).reduce((s2, s) => s2 + s.amount, 0)),
      openWeightedAmount: Math.round(stages.filter((s) => !s.closed).reduce((s2, s) => s2 + s.weightedAmount, 0)),
    };
  },
};

/**
 * Répartition des deals par ÉTAPE de pipeline, lue EN DIRECT depuis HubSpot
 * (vraies étapes nommées, comme les dashboards). Contourne le cas où la table
 * canonique n'a pas mappé le dealstage (tous les deals en « Sans étape »).
 */
export const getPipelineStageBreakdown: AgentTool = {
  def: {
    name: "get_pipeline_stage_breakdown",
    description:
      "Répartition des deals par ÉTAPE de pipeline lue EN DIRECT depuis HubSpot (les vraies étapes nommées, source des dashboards) — à PRÉFÉRER à get_pipeline_by_stage quand on veut les phases réelles du pipeline. Retourne, par pipeline, le nombre de deals et le montant par étape, filtrés sur les N derniers mois (date de création). À utiliser pour tout rapport « deals/transactions par phase/étape ».",
    input_schema: {
      type: "object",
      properties: {
        months: { type: "integer", description: "Fenêtre en mois sur la date de création (défaut 3, max 24)." },
        pipeline: { type: "string", description: "Filtre optionnel par nom de pipeline (sous-chaîne)." },
      },
    },
  },
  run: async (input, ctx: AgentContext) => {
    if (!ctx.hubspotToken) return { hasData: false, note: "HubSpot n'est pas connecté sur cette org." };
    const token = ctx.hubspotToken;
    const months = Math.min(Math.max(Number(input.months) || 3, 1), 24);

    const pipelines = (await fetchDealsPipelines(token)).filter((p) => !p.archived);
    if (pipelines.length === 0)
      return { hasData: false, note: "Aucun pipeline deals accessible dans HubSpot (scope OAuth manquant ?)." };

    const nameFilter = typeof input.pipeline === "string" ? input.pipeline.toLowerCase().trim() : "";
    let selected = nameFilter ? pipelines.filter((p) => p.label.toLowerCase().includes(nameFilter)) : pipelines;
    let matched = true;
    if (selected.length === 0) {
      selected = pipelines;
      matched = false;
    }
    const pipelineIds = selected.map((p) => p.id);

    // Deals créés sur les N derniers mois dans les pipelines sélectionnés.
    const cutoff = Date.now() - months * 30 * 86_400_000;
    const props: Record<string, string>[] = [];
    let after: string | undefined;
    let page = 0;
    do {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "createdate", operator: "GTE", value: String(cutoff) },
                { propertyName: "pipeline", operator: "IN", values: pipelineIds },
              ],
            },
          ],
          properties: ["dealstage", "pipeline", "amount"],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const r of (data.results ?? []) as Array<{ properties?: Record<string, string> }>) {
        props.push(r.properties ?? {});
      }
      after = data.paging?.next?.after;
      page++;
    } while (after && page < 25);

    if (props.length === 0)
      return {
        hasData: false,
        months,
        note: `Aucun deal créé sur les ${months} derniers mois dans ${matched ? "ce pipeline" : "les pipelines HubSpot"}.`,
      };

    const agg = new Map<string, { count: number; amount: number }>();
    for (const r of props) {
      const sid = r.dealstage;
      if (!sid) continue;
      const e = agg.get(sid) ?? { count: 0, amount: 0 };
      e.count++;
      e.amount += Number(r.amount) || 0;
      agg.set(sid, e);
    }

    const byPipeline = selected.map((p) => ({
      pipeline: p.label,
      stages: [...p.stages]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => {
          const e = agg.get(s.id) ?? { count: 0, amount: 0 };
          return { stage: s.label, deals: e.count, amount: Math.round(e.amount), probability: s.probability };
        }),
    }));

    return {
      hasData: true,
      source: "hubspot_live",
      months,
      pipelineNameMatched: matched,
      availablePipelines: pipelines.map((p) => p.label),
      pipelines: byPipeline,
      totalDeals: props.length,
    };
  },
};

/** Série temporelle du revenu facturé / encaissé par mois (tables canoniques). */
export const getRevenueTimeseries: AgentTool = {
  def: {
    name: "get_revenue_timeseries",
    description:
      "Ventile le revenu par mois à partir de la table canonique invoices : montant facturé par mois (sur issued_at) et montant encaissé par mois (sur paid_at). Pour tout graphique/série temporelle de facturation, d'encaissement ou de tendance revenue. Ne dépend PAS du snapshot KPI.",
    input_schema: {
      type: "object",
      properties: { months: { type: "integer", description: "Nombre de mois d'historique (défaut 6, max 24)." } },
    },
  },
  run: async (input, ctx: AgentContext) => {
    const months = Math.min(Math.max(Number(input.months) || 6, 1), 24);
    let q = ctx.supabase
      .from("invoices")
      .select("issued_at, paid_at, amount_total, amount_paid, primary_source")
      .eq("organization_id", ctx.orgId)
      .limit(8000);
    const src = billingSourceFilter(ctx.sources);
    if (src) q = q.in("primary_source", src);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0) return { hasData: false, note: "Aucune facture dans la table canonique pour ces sources." };
    const keys = monthKeys(months);
    const acc: Record<string, { invoiced: number; paid: number }> = {};
    for (const k of keys) acc[k] = { invoiced: 0, paid: 0 };
    for (const r of rows) {
      const im = String(r.issued_at ?? "").slice(0, 7);
      if (acc[im]) acc[im].invoiced += Number(r.amount_total) || 0;
      const pm = String(r.paid_at ?? "").slice(0, 7);
      if (acc[pm]) acc[pm].paid += Number(r.amount_paid) || Number(r.amount_total) || 0;
    }
    return {
      hasData: true,
      months,
      byMonth: keys.map((k) => ({ month: k, invoiced: Math.round(acc[k].invoiced), paid: Math.round(acc[k].paid) })),
    };
  },
};

/** Agrégation générique sur les tables canoniques (anticipe les analyses non prévues). */
type AggSpec = {
  columns: string;
  hasSource?: boolean;
  /** Table physique quand elle diffère du nom d'entité (ex : transactions → bank_transactions). */
  table?: string;
  dims: Record<string, (r: Record<string, unknown>) => string | null>;
  numeric: Record<string, (r: Record<string, unknown>) => number>;
};
function monthOf(v: unknown): string | null {
  const s = String(v ?? "");
  return s.length >= 7 ? s.slice(0, 7) : null;
}
function relName(rel: unknown): string {
  if (!rel) return "Sans étape";
  const o = (Array.isArray(rel) ? rel[0] : rel) as { name?: string } | undefined;
  return o?.name ?? "Sans étape";
}
/** Champ arbitraire d'une relation Supabase (objet ou tableau à 1 élément). */
function relField(rel: unknown, key: string): string | null {
  if (!rel) return null;
  const o = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined;
  const v = o?.[key];
  return typeof v === "string" && v ? v : null;
}
/** Champ BOOLÉEN d'une relation Supabase (ex : pipeline_stages.is_closed_won). */
function relFlag(rel: unknown, key: string): boolean {
  if (!rel) return false;
  const o = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined;
  return o?.[key] === true;
}
/** Champ NUMÉRIQUE d'une relation Supabase (ex : pipeline_stages.probability). */
function relNum(rel: unknown, key: string): number | null {
  if (!rel) return null;
  const o = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined;
  const v = o?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") { const n = Number(v); return Number.isNaN(n) ? null : n; }
  return null;
}

/** Étape de pipeline résolue depuis HubSpot (source de vérité des noms d'étapes). */
type StageInfo = {
  label: string;
  position: number;
  probability: number;
  closedWon: boolean;
  closedLost: boolean;
  /** Pipeline parent — lève l'ambiguïté des libellés d'étape homonymes. */
  pipelineId: string;
  pipelineLabel: string;
};

/**
 * Map stageId (HubSpot) → infos d'étape, lue en direct depuis HubSpot. Sert de
 * source fiable des NOMS d'étapes quand la table canonique n'a pas mappé le
 * dealstage (deals.stage_id non peuplé par l'ETL). Sans token → map vide.
 */
async function resolveStageMap(token: string | null): Promise<Map<string, StageInfo>> {
  const map = new Map<string, StageInfo>();
  if (!token) return map;
  try {
    const pipelines = await fetchDealsPipelines(token);
    for (const p of pipelines) {
      for (const s of p.stages) {
        map.set(s.id, {
          label: s.label,
          position: s.displayOrder,
          probability: s.probability,
          closedWon: s.closedWon,
          closedLost: s.closedLost,
          pipelineId: p.id,
          pipelineLabel: p.label,
        });
      }
    }
  } catch {
    /* réseau/scope → map vide, fallback « Sans étape » */
  }
  return map;
}
// ── Statut d'un deal depuis l'étape canonique (is_closed_won / is_closed_lost).
//    Libellés partagés entre les dims status/outcome/close_date_state et les
//    presets de tuiles (target) — ne pas les modifier sans migrer les agg_spec.
export const DEAL_STATUS_LABELS = { open: "En cours", won: "Gagnés", lost: "Perdus" } as const;
function dealStatusLabel(won: boolean, lost: boolean): string {
  return won ? DEAL_STATUS_LABELS.won : lost ? DEAL_STATUS_LABELS.lost : DEAL_STATUS_LABELS.open;
}
// État de la close date d'un deal EN COURS : dépassée (date < aujourd'hui),
// à jour, ou absente. Les deals clôturés sont hors périmètre (null → ignorés).
export const CLOSE_DATE_LABELS = { overdue: "Dépassée", current: "À jour", missing: "Sans close date" } as const;
function closeDateStateLabel(closeDate: unknown): string {
  const d = String(closeDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return CLOSE_DATE_LABELS.missing;
  return d < new Date().toISOString().slice(0, 10) ? CLOSE_DATE_LABELS.overdue : CLOSE_DATE_LABELS.current;
}

const AGG_SPECS: Record<string, AggSpec> = {
  deals: {
    columns:
      "amount, created_date, close_date, stage_external_id, pipeline_stages(name, pipeline_name, pipeline_external_id, probability, is_closed_won, is_closed_lost)",
    dims: {
      month_created: (r) => monthOf(r.created_date),
      month_closed: (r) => monthOf(r.close_date),
      // Résolus dynamiquement dans computeAggregate via HubSpot quand le
      // canonique n'est pas mappé (cf. resolveStageMap).
      stage: (r) => relName(r.pipeline_stages),
      pipeline: (r) => relField(r.pipeline_stages, "pipeline_name") ?? "Sans pipeline",
      // Statut du deal : En cours / Gagnés / Perdus (tous les deals).
      status: (r) => dealStatusLabel(relFlag(r.pipeline_stages, "is_closed_won"), relFlag(r.pipeline_stages, "is_closed_lost")),
      // Résultat des deals CLÔTURÉS uniquement (Gagnés / Perdus) — les deals en
      // cours sont ignorés : percent_of_total sur « Perdus » = vrai taux de perte.
      outcome: (r) => {
        const won = relFlag(r.pipeline_stages, "is_closed_won");
        const lost = relFlag(r.pipeline_stages, "is_closed_lost");
        return won || lost ? dealStatusLabel(won, lost) : null;
      },
      // Hygiène des deals EN COURS : close date dépassée / à jour / absente.
      close_date_state: (r) =>
        relFlag(r.pipeline_stages, "is_closed_won") || relFlag(r.pipeline_stages, "is_closed_lost")
          ? null
          : closeDateStateLabel(r.close_date),
      // Étape qualifiée par son pipeline : zéro ambiguïté entre deux pipelines
      // qui partagent un libellé d'étape (« Closed won », « Qualification »…).
      stage_pipeline: (r) =>
        `${relField(r.pipeline_stages, "pipeline_name") ?? "Sans pipeline"} › ${relName(r.pipeline_stages)}`,
    },
    numeric: { amount: (r) => Number(r.amount) || 0 },
  },
  invoices: {
    columns: "amount_total, amount_paid, amount_due, status, primary_source, issued_at, paid_at",
    hasSource: true,
    dims: {
      status: (r) => String(r.status ?? "inconnu"),
      source: (r) => String(r.primary_source ?? "inconnu"),
      month_issued: (r) => monthOf(r.issued_at),
      month_paid: (r) => monthOf(r.paid_at),
    },
    numeric: {
      amount_total: (r) => Number(r.amount_total) || 0,
      amount_paid: (r) => Number(r.amount_paid) || 0,
      amount_due: (r) => Number(r.amount_due) || 0,
    },
  },
  subscriptions: {
    columns: "mrr, status, primary_source, started_at, canceled_at",
    hasSource: true,
    dims: {
      status: (r) => String(r.status ?? "inconnu"),
      source: (r) => String(r.primary_source ?? "inconnu"),
      month_started: (r) => monthOf(r.started_at),
      month_canceled: (r) => monthOf(r.canceled_at),
    },
    numeric: { mrr: (r) => Number(r.mrr) || 0 },
  },
  // Transactions bancaires (Pennylane & co) : les PAIEMENTS réels, même sans
  // facture émise. amount signé : > 0 encaissement, < 0 décaissement.
  transactions: {
    table: "bank_transactions",
    columns: "amount, date, primary_source, category",
    hasSource: true,
    dims: {
      month_transaction: (r) => monthOf(r.date),
      direction: (r) => ((Number(r.amount) || 0) >= 0 ? "Encaissements" : "Décaissements"),
      category: (r) => String(r.category ?? "Non catégorisé"),
      source: (r) => String(r.primary_source ?? "inconnu"),
    },
    numeric: {
      // Net signé (encaissements − décaissements).
      amount: (r) => Number(r.amount) || 0,
      // Encaissements uniquement (montants entrants, positifs).
      amount_in: (r) => Math.max(0, Number(r.amount) || 0),
      // Décaissements uniquement (montants sortants, renvoyés positifs).
      amount_out: (r) => Math.max(0, -(Number(r.amount) || 0)),
    },
  },
  tickets: {
    columns: "status",
    dims: { status: (r) => String(r.status ?? "inconnu") },
    numeric: {},
  },
  companies: {
    columns: "segment, industry, country_code",
    dims: {
      segment: (r) => String(r.segment ?? "inconnu"),
      industry: (r) => String(r.industry ?? "inconnu"),
      country: (r) => String(r.country_code ?? "inconnu"),
    },
    numeric: {},
  },
  contacts: {
    columns: "is_mql, is_sql",
    dims: {
      mql: (r) => (r.is_mql ? "MQL" : "non-MQL"),
      sql: (r) => (r.is_sql ? "SQL" : "non-SQL"),
    },
    numeric: {},
  },
};

/** Colonne de date à filtrer pour une entité/dimension (recalcul par période). */
/**
 * Entités agrégeables → table physique + présence d'une colonne primary_source.
 * Sert au garde-fou « données réelles » du câblage des KPIs personnalisés
 * (compter les lignes par entité pour éviter un câblage sur un endpoint vide).
 */
export const AGG_ENTITY_TABLES: { entity: string; table: string; hasSource: boolean }[] =
  Object.entries(AGG_SPECS).map(([entity, s]) => ({
    entity,
    table: s.table ?? entity,
    hasSource: !!s.hasSource,
  }));

function dateColumnFor(entity: string, groupBy: string): string | null {
  if (groupBy.startsWith("month_")) {
    const suffix = groupBy.slice(6);
    const m: Record<string, string> = {
      created: "created_date", closed: "close_date", issued: "issued_at",
      paid: "paid_at", started: "started_at", canceled: "canceled_at",
      transaction: "date",
    };
    return m[suffix] ?? null;
  }
  const def: Record<string, string> = { deals: "created_date", invoices: "issued_at", subscriptions: "started_at", transactions: "date" };
  return def[entity] ?? null;
}

/** Fréquences d'affichage des dimensions temporelles (month_*). */
export const TIME_GRANULARITIES = ["day", "week", "month", "quarter", "semester", "year"] as const;
export type TimeGranularity = (typeof TIME_GRANULARITIES)[number];

/** Semaine ISO « YYYY-Www » d'une date (lundi = 1er jour). */
function isoWeekKey(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Bucket temporel d'une valeur date selon la fréquence (clés triables). */
function timeBucketOf(v: unknown, g: TimeGranularity): string | null {
  const s = String(v ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return monthOf(v);
  const [y, m, d] = s.split("-").map(Number);
  switch (g) {
    case "day": return s;
    case "week": return isoWeekKey(y, m, d);
    case "quarter": return `${y}-T${Math.ceil(m / 3)}`;
    case "semester": return `${y}-S${m <= 6 ? 1 : 2}`;
    case "year": return String(y);
    default: return s.slice(0, 7);
  }
}

/**
 * Clés temporelles continues entre deux dates pour la fréquence donnée (buckets
 * vides inclus → axes réguliers). null si la plage dépasse le plafond de la
 * fréquence (on retombe alors sur les clés observées, triées).
 */
function timeKeysBetween(from: string, to: string, g: TimeGranularity): string[] | null {
  const CAPS: Record<TimeGranularity, number> = { day: 400, week: 160, month: 120, quarter: 60, semester: 40, year: 30 };
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  const out: string[] = [];
  const cur = new Date(start);
  for (let i = 0; i < CAPS[g] + 40; i++) {
    const key = timeBucketOf(cur.toISOString().slice(0, 10), g);
    if (key && out[out.length - 1] !== key) out.push(key);
    if (out.length > CAPS[g]) return null;
    if (cur >= end) break;
    // Pas d'itération : le plus petit incrément sûr par fréquence.
    if (g === "day") cur.setUTCDate(cur.getUTCDate() + 1);
    else if (g === "week") cur.setUTCDate(cur.getUTCDate() + 7);
    else cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  // Bucket de la borne de fin (si le dernier pas l'a dépassée sans l'inclure).
  const endKey = timeBucketOf(to, g);
  if (endKey && out[out.length - 1] !== endKey) out.push(endKey);
  return out;
}

/** Mois YYYY-MM entre deux dates (inclus). */
function monthKeysBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy, mo = fm;
  for (let i = 0; i < 120; i++) {
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
    if (y === ty && mo === tm) break;
    mo++;
    if (mo > 12) { mo = 1; y++; }
    if (y > ty || (y === ty && mo > tm)) break;
  }
  return out;
}

export type AggregateSpec = {
  entity: string;
  groupBy: string;
  measure?: string;
  field?: string | null;
  months?: number;
  date_from?: string | null;
  date_to?: string | null;
  /**
   * Restreint l'agrégat à UN pipeline (deals uniquement), par id externe HubSpot
   * ou par nom. Rend `groupBy: "stage"` non ambigu quand deux pipelines
   * partagent un libellé d'étape.
   */
  pipeline?: string | null;
  /**
   * Fréquence d'affichage des dimensions temporelles (month_*) :
   * day | week | month (défaut) | quarter | semester | year.
   */
  granularity?: string | null;
  /**
   * Filtre COHORTE : restreint aux enregistrements dont l'ENTREPRISE appartient
   * à la cohorte — key ∈ { segment, industry }, value = bucket exact (colonnes
   * canoniques companies.segment / companies.industry ; « inconnu » = null).
   * Companies : filtre direct ; autres entités : jointure via company_id.
   */
  cohort?: { key: string; value: string } | null;
  /**
   * Mode DÉTAIL (drill-down) : au lieu de l'agrégat, renvoie les
   * ENREGISTREMENTS sous-jacents (contacts, deals, factures…) — mêmes filtres
   * (sources, période, pipeline) et même résolution de bucket que l'agrégat.
   */
  detail?: boolean;
  /** Bucket ciblé (clé BRUTE du moteur : « 2026-01 », « Closed won »…) — absent = tous. */
  detailBucket?: string | null;
};

// ── Drill-down : colonnes riches et projection d'affichage par entité ───────
// Sélection élargie pour le détail (nom, client, montants, dates) ; en cas de
// colonne absente (schéma partiel), repli automatique sur les colonnes de
// l'agrégat. kind pilote le formatage côté client (currency/date/text).
const DETAIL_COLUMNS: Record<string, string> = {
  deals:
    "name, amount, created_date, close_date, days_in_stage, last_activity_at, is_at_risk, stage_external_id, pipeline_stages(name, pipeline_name, pipeline_external_id, probability, is_closed_won, is_closed_lost), companies(name)",
  invoices:
    "number, status, amount_total, amount_paid, amount_due, issued_at, paid_at, due_at, primary_source, companies(name)",
  subscriptions: "mrr, status, primary_source, started_at, canceled_at, current_period_end, companies(name)",
  transactions: "label, amount, date, category, primary_source",
  companies: "name, domain, segment, industry, country_code, annual_revenue, employee_count, created_at",
  contacts: "full_name, email, title, phone, lifecycle_stage, hs_created_at, is_mql, is_sql, companies(name)",
  tickets: "subject, status, priority, channel, assignee_email, opened_at, resolved_at, primary_source",
};

export type DetailColumn = {
  id: string;
  label: string;
  kind?: "text" | "currency" | "date" | "count" | "percent";
  /** Colonne affichée par défaut (false = suggestion activable dans le modal). */
  default?: boolean;
};

/**
 * Catalogue de colonnes de détail par entité : les colonnes `default` sont
 * affichées d'emblée, les autres sont des SUGGESTIONS activables dans le modal
 * (« Colonnes »). Le serveur renvoie TOUTES les valeurs — l'affichage se
 * filtre côté client, instantanément.
 */
type DetailField = DetailColumn & { value: (r: Record<string, unknown>) => unknown };
const DETAIL_FIELDS: Record<string, DetailField[]> = {
  deals: [
    { id: "name", label: "Deal", default: true, value: (r) => r.name ?? "—" },
    { id: "company", label: "Entreprise", default: true, value: (r) => relField(r.companies, "name") ?? "—" },
    { id: "stage", label: "Étape", default: true, value: (r) => relName(r.pipeline_stages) },
    { id: "amount", label: "Montant", kind: "currency", default: true, value: (r) => Number(r.amount) || 0 },
    { id: "created", label: "Créé le", kind: "date", default: true, value: (r) => r.created_date ?? null },
    { id: "closed", label: "Closing", kind: "date", default: true, value: (r) => r.close_date ?? null },
    { id: "pipeline", label: "Pipeline", value: (r) => relField(r.pipeline_stages, "pipeline_name") ?? "—" },
    { id: "probability", label: "Probabilité", kind: "percent", value: (r) => relNum(r.pipeline_stages, "probability") },
    { id: "days_in_stage", label: "Jours dans l'étape", kind: "count", value: (r) => Number(r.days_in_stage) || 0 },
    { id: "last_activity", label: "Dernière activité", kind: "date", value: (r) => r.last_activity_at ?? null },
    { id: "at_risk", label: "À risque", value: (r) => (r.is_at_risk ? "Oui" : "—") },
  ],
  invoices: [
    { id: "number", label: "Facture", default: true, value: (r) => r.number ?? "—" },
    { id: "company", label: "Client", default: true, value: (r) => relField(r.companies, "name") ?? "—" },
    { id: "status", label: "Statut", default: true, value: (r) => r.status ?? "—" },
    { id: "amount_total", label: "Montant", kind: "currency", default: true, value: (r) => Number(r.amount_total) || 0 },
    { id: "amount_due", label: "Restant dû", kind: "currency", default: true, value: (r) => Number(r.amount_due) || 0 },
    { id: "issued", label: "Émise le", kind: "date", default: true, value: (r) => r.issued_at ?? null },
    { id: "source", label: "Source", default: true, value: (r) => r.primary_source ?? "—" },
    { id: "amount_paid", label: "Payé", kind: "currency", value: (r) => Number(r.amount_paid) || 0 },
    { id: "paid", label: "Payée le", kind: "date", value: (r) => r.paid_at ?? null },
    { id: "due", label: "Échéance", kind: "date", value: (r) => r.due_at ?? null },
  ],
  subscriptions: [
    { id: "company", label: "Client", default: true, value: (r) => relField(r.companies, "name") ?? "—" },
    { id: "status", label: "Statut", default: true, value: (r) => r.status ?? "—" },
    { id: "mrr", label: "MRR", kind: "currency", default: true, value: (r) => Number(r.mrr) || 0 },
    { id: "started", label: "Début", kind: "date", default: true, value: (r) => r.started_at ?? null },
    { id: "canceled", label: "Annulé le", kind: "date", default: true, value: (r) => r.canceled_at ?? null },
    { id: "source", label: "Source", default: true, value: (r) => r.primary_source ?? "—" },
    { id: "arr", label: "ARR", kind: "currency", value: (r) => Math.round((Number(r.mrr) || 0) * 12) },
    { id: "period_end", label: "Fin de période", kind: "date", value: (r) => r.current_period_end ?? null },
  ],
  transactions: [
    { id: "label", label: "Libellé", default: true, value: (r) => r.label ?? "—" },
    { id: "date", label: "Date", kind: "date", default: true, value: (r) => r.date ?? null },
    { id: "amount", label: "Montant", kind: "currency", default: true, value: (r) => Number(r.amount) || 0 },
    { id: "category", label: "Catégorie", default: true, value: (r) => r.category ?? "—" },
    { id: "source", label: "Source", default: true, value: (r) => r.primary_source ?? "—" },
  ],
  companies: [
    { id: "name", label: "Entreprise", default: true, value: (r) => r.name ?? "—" },
    { id: "segment", label: "Segment", default: true, value: (r) => r.segment ?? "—" },
    { id: "industry", label: "Industrie", default: true, value: (r) => r.industry ?? "—" },
    { id: "country", label: "Pays", default: true, value: (r) => r.country_code ?? "—" },
    { id: "domain", label: "Domaine", value: (r) => r.domain ?? "—" },
    { id: "revenue", label: "CA annuel", kind: "currency", value: (r) => (r.annual_revenue == null ? null : Number(r.annual_revenue) || 0) },
    { id: "employees", label: "Effectif", kind: "count", value: (r) => (r.employee_count == null ? null : Number(r.employee_count) || 0) },
    { id: "created", label: "Créée le", kind: "date", value: (r) => r.created_at ?? null },
  ],
  contacts: [
    { id: "name", label: "Contact", default: true, value: (r) => r.full_name ?? "—" },
    { id: "email", label: "Email", default: true, value: (r) => r.email ?? "—" },
    { id: "lifecycle", label: "Lifecycle", default: true, value: (r) => r.lifecycle_stage ?? "—" },
    { id: "created", label: "Créé le", kind: "date", default: true, value: (r) => r.hs_created_at ?? null },
    { id: "company", label: "Entreprise", value: (r) => relField(r.companies, "name") ?? "—" },
    { id: "title", label: "Fonction", value: (r) => r.title ?? "—" },
    { id: "phone", label: "Téléphone", value: (r) => r.phone ?? "—" },
    { id: "mql", label: "MQL", value: (r) => (r.is_mql ? "Oui" : "—") },
    { id: "sql", label: "SQL", value: (r) => (r.is_sql ? "Oui" : "—") },
  ],
  tickets: [
    { id: "subject", label: "Sujet", default: true, value: (r) => r.subject ?? "—" },
    { id: "status", label: "Statut", default: true, value: (r) => r.status ?? "—" },
    { id: "priority", label: "Priorité", default: true, value: (r) => r.priority ?? "—" },
    { id: "opened", label: "Ouvert le", kind: "date", default: true, value: (r) => r.opened_at ?? null },
    { id: "channel", label: "Canal", value: (r) => r.channel ?? "—" },
    { id: "assignee", label: "Assigné à", value: (r) => r.assignee_email ?? "—" },
    { id: "resolved", label: "Résolu le", kind: "date", value: (r) => r.resolved_at ?? null },
    { id: "source", label: "Source", value: (r) => r.primary_source ?? "—" },
  ],
};

/**
 * Moteur d'agrégation DÉTERMINISTE sur les tables canoniques. Même code pour le
 * tool agent ET pour le recalcul par période (fiabilité 100 % : mêmes chiffres,
 * seules les bornes de dates changent). Filtre par source (cross-source) et par
 * période exacte (date_from/date_to).
 */
/** Colonnes canoniques des cohortes standard (repli sans mapping). */
const CANONICAL_COHORT_COLS: Record<string, string> = { segment: "segment", industry: "industry" };

/** Objets CRM porteurs d'une cohorte (Paramètres → Cohortes). */
export type CohortObject = "companies" | "contacts" | "deals";
const COHORT_OBJECTS = new Set<CohortObject>(["companies", "contacts", "deals"]);

/**
 * Où lire la valeur d'une cohorte : la propriété CRM mappée dans Paramètres →
 * Cohortes — sur SON objet (companies / contacts / deals, valeurs synchronisées
 * dans raw_data.properties de l'objet) ; objet vide (détection auto legacy) →
 * companies. Repli sur la colonne canonique companies (industry/segment).
 * { prop: null, col: null } = cohorte non filtrable.
 */
export async function resolveCohortAccessor(
  supabase: AgentContext["supabase"],
  orgId: string,
  key: string,
): Promise<{ prop: string | null; col: string | null; object: CohortObject }> {
  let prop: string | null = null;
  let object: CohortObject = "companies";
  try {
    const { data } = await supabase
      .from("cohort_mappings")
      .select("mappings")
      .eq("organization_id", orgId)
      .maybeSingle();
    const mappings = Array.isArray(data?.mappings)
      ? (data.mappings as Array<{ key?: string; api_name?: string; object?: string }>)
      : [];
    const m = mappings.find((x) => x.key === key && (x.api_name ?? "").trim());
    if (m) {
      prop = (m.api_name as string).trim();
      object = COHORT_OBJECTS.has(m.object as CohortObject) ? (m.object as CohortObject) : "companies";
    }
  } catch {
    /* table absente → repli canonique */
  }
  const col = CANONICAL_COHORT_COLS[key] ?? null;
  return { prop, col: prop ? null : col, object };
}

/**
 * TOUTES les cohortes lisibles sur l'entreprise (Paramètres → Cohortes, objet
 * Company : propriété mappée dans raw_data) + les canoniques segment/industry
 * en repli — colonnes « cohorte » du détail (drill-down des rapports).
 */
async function listCompanyCohortAccessors(
  supabase: AgentContext["supabase"],
  orgId: string,
): Promise<Array<{ key: string; label: string; prop: string | null; col: string | null }>> {
  const out: Array<{ key: string; label: string; prop: string | null; col: string | null }> = [];
  const seen = new Set<string>();
  try {
    const { data } = await supabase
      .from("cohort_mappings")
      .select("mappings")
      .eq("organization_id", orgId)
      .maybeSingle();
    const mappings = Array.isArray(data?.mappings)
      ? (data.mappings as Array<{ key?: string; label?: string; internal_name?: string; api_name?: string; object?: string }>)
      : [];
    for (const m of mappings) {
      const key = typeof m.key === "string" ? m.key : "";
      const prop = typeof m.api_name === "string" ? m.api_name.trim() : "";
      if (!key || !prop || (m.object && m.object !== "companies")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      // Libellé = le nom de propriété saisi par l'utilisateur (son vocabulaire),
      // repli sur le libellé standard de la ligne de Paramètres.
      const label =
        (typeof m.internal_name === "string" && m.internal_name.trim()) ||
        (typeof m.label === "string" && m.label.trim()) ||
        key;
      out.push({ key, label, prop, col: null });
    }
  } catch {
    /* table absente → canoniques seulement */
  }
  for (const [key, col] of Object.entries(CANONICAL_COHORT_COLS)) {
    if (seen.has(key)) continue;
    out.push({ key, label: key === "industry" ? "Secteur d'activité" : "Segment", prop: null, col });
  }
  return out.slice(0, 12);
}

export async function computeAggregate(
  supabase: AgentContext["supabase"],
  orgId: string,
  sources: string[],
  hubspotToken: string | null,
  input: AggregateSpec,
): Promise<Record<string, unknown>> {
  const entity = String(input.entity ?? "");
  const spec = AGG_SPECS[entity];
  if (!spec) return { error: `Entité non supportée: ${entity}. Choisir: ${Object.keys(AGG_SPECS).join(", ")}.` };
  const groupBy = String(input.groupBy ?? "");
  // ── Champs MÉTIER supplémentaires des connecteurs sur mesure ──
  // Dimension "extra.<id>" (libellé) et champ numérique "extra.<id>" : lus dans
  // source_metadata.extra, posé à la sync custom (migration 20260819000002).
  // Uniquement sur les entités qui portent source_metadata.
  const EXTRA_ENTITIES = new Set(["deals", "invoices", "subscriptions", "transactions", "tickets"]);
  const readExtra = (r: Record<string, unknown>, id: string): unknown => {
    const meta = r.source_metadata as Record<string, unknown> | null | undefined;
    const extra = meta?.extra as Record<string, unknown> | undefined;
    return extra?.[id];
  };
  const extraDim = groupBy.startsWith("extra.") ? groupBy.slice(6) : null;
  if (extraDim && !EXTRA_ENTITIES.has(entity)) {
    return { error: `Dimension extra.* non disponible pour ${entity} (réservée aux entités des connecteurs sur mesure).` };
  }
  // Dimension COHORTE dynamique : « cohort.<key> » sur l'objet PORTEUR de la
  // cohorte (companies / contacts / deals) — résolue après le fetch (propriété
  // mappée dans raw_data, sinon colonne canonique companies). Sert aussi de
  // source des valeurs du filtre cohorte des rapports.
  const COHORT_DIM_ENTITIES = new Set(["companies", "contacts", "deals"]);
  const cohortDimKey = COHORT_DIM_ENTITIES.has(entity) && groupBy.startsWith("cohort.") ? groupBy.slice(7) : null;
  const dimFn = extraDim
    ? (r: Record<string, unknown>) => {
        const v = readExtra(r, extraDim);
        return v == null || v === "" ? null : String(v);
      }
    : cohortDimKey
      ? () => null // placeholder — remplacé par resolveDim après résolution du mapping
      : spec.dims[groupBy];
  if (!dimFn) return { error: `Dimension non supportée pour ${entity}: ${groupBy}. Choisir: ${Object.keys(spec.dims).join(", ")}.` };
  const measure = ["count", "sum", "avg", "weighted"].includes(String(input.measure)) ? String(input.measure) : "count";
  // « weighted » (projection pondérée par la probabilité de closing) n'a de sens
  // que sur les deals — refus explicite ailleurs plutôt qu'un chiffre trompeur.
  if (measure === "weighted" && entity !== "deals") {
    return { error: `Mesure « weighted » réservée aux deals (projection pondérée). Entité reçue : ${entity}.` };
  }
  let numFn: ((r: Record<string, unknown>) => number) | null = null;
  const field = input.field ? String(input.field) : null;
  const extraField = field?.startsWith("extra.") ? field.slice(6) : null;
  if (extraField && !EXTRA_ENTITIES.has(entity)) {
    return { error: `Champ extra.* non disponible pour ${entity} (réservé aux entités des connecteurs sur mesure).` };
  }
  if (measure !== "count") {
    if (extraField) {
      numFn = (r) => Number(readExtra(r, extraField)) || 0;
    } else if (!field || !spec.numeric[field]) {
      return { error: `Champ numérique requis pour ${measure} sur ${entity}. Choisir: ${Object.keys(spec.numeric).join(", ") || "(aucun)"}.` };
    } else {
      numFn = spec.numeric[field];
    }
  }
  const months = Math.min(Math.max(Number(input.months) || 12, 1), 36);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = input.date_from && dateRe.test(input.date_from) ? input.date_from : null;
  const to = input.date_to && dateRe.test(input.date_to) ? input.date_to : null;
  const dateCol = dateColumnFor(entity, groupBy);

  // ── Filtre COHORTE : segment/industry canoniques + TOUTES les cohortes de
  // Paramètres → Cohortes (objet Company) — leurs valeurs vivent dans
  // companies.raw_data (propriétés demandées par la sync). « inconnu » = null.
  const COHORT_ENTITIES = new Set(["companies", "deals", "contacts", "invoices", "subscriptions", "tickets"]);
  const cohortKey = input.cohort?.key ? String(input.cohort.key) : null;
  const cohortValue =
    cohortKey && typeof input.cohort?.value === "string" && input.cohort.value !== "" ? input.cohort.value : null;
  if (cohortValue && !COHORT_ENTITIES.has(entity)) {
    return { error: `Filtre cohorte non disponible pour ${entity} (entreprises requises : deals, contacts, factures, abonnements, tickets).` };
  }
  // Accessor du filtre résolu AVANT le fetch : il détermine les colonnes à
  // sélectionner (raw_data si la cohorte est portée par l'entité elle-même).
  let cohortAcc: { prop: string | null; col: string | null; object: CohortObject } | null = null;
  if (cohortValue && cohortKey) {
    cohortAcc = await resolveCohortAccessor(supabase, orgId, cohortKey);
    if (!cohortAcc.prop && !cohortAcc.col) {
      return { error: `Cohorte inconnue ou non mappée : ${cohortKey}. Mappe-la dans Paramètres → Cohortes.` };
    }
  }

  // Mode détail : colonnes riches (nom, client, montants…) avec repli sur les
  // colonnes de l'agrégat si le schéma ne les porte pas toutes.
  const wantDetail = input.detail === true;
  const src = billingSourceFilter(sources);
  const buildQuery = (cols: string) => {
    let qb = supabase.from(spec.table ?? entity).select(cols).eq("organization_id", orgId).limit(10000);
    if (src && spec.hasSource) qb = qb.in("primary_source", src);
    // Période exacte : filtre déterministe sur la vraie colonne de date.
    if (dateCol && from) qb = qb.gte(dateCol, from);
    if (dateCol && to) qb = qb.lte(dateCol, to);
    return qb;
  };
  // Les dimensions/champs extra.* lisent source_metadata → colonne ajoutée au select.
  const withExtraCols = (cols: string) =>
    (extraDim || extraField) && !cols.includes("source_metadata") ? `${cols}, source_metadata` : cols;
  // Filtre cohorte : jointure JS via company_id (autres entités) ou id
  // (companies) ; cohorte portée par l'entité elle-même → raw_data direct ;
  // dimension cohort.<key> → raw_data (propriétés mappées).
  const withCohortCols = (cols: string) => {
    let out = cols;
    if (cohortValue && entity !== "companies" && !out.includes("company_id")) out = `${out}, company_id`;
    if (cohortValue && entity === "companies" && !/(^|,\s*)id(\s*,|$)/.test(out)) out = `id, ${out}`;
    if (cohortValue && cohortAcc?.prop && cohortAcc.object === entity && !out.includes("raw_data")) out = `${out}, raw_data`;
    // Cohorte CONTACT sur les deals : lien direct deal → contact (association
    // HubSpot) — la colonne peut être absente (migration récente), repli plus bas.
    if (cohortValue && cohortAcc?.object === "contacts" && entity === "deals" && !out.includes("contact_id")) out = `${out}, contact_id`;
    if (cohortDimKey && !out.includes("raw_data")) out = `${out}, raw_data`;
    return out;
  };
  // Mode détail : clé de jointure vers l'entreprise (colonnes cohortes) —
  // id pour companies, company_id pour les entités rattachées.
  const withDetailLinkCols = (cols: string) => {
    if (!wantDetail) return cols;
    let out = cols;
    if (entity === "companies") {
      if (!/(^|,\s*)id(\s*,|$)/.test(out)) out = `id, ${out}`;
    } else if (["deals", "invoices", "subscriptions", "contacts", "tickets", "transactions"].includes(entity) && !out.includes("company_id")) {
      out = `${out}, company_id`;
    }
    return out;
  };
  const detailCols = withDetailLinkCols(withCohortCols(withExtraCols(wantDetail ? DETAIL_COLUMNS[entity] ?? spec.columns : spec.columns)));
  let { data, error } = await buildQuery(detailCols);
  if (error && wantDetail && detailCols !== withDetailLinkCols(withCohortCols(withExtraCols(spec.columns)))) {
    ({ data, error } = await buildQuery(withDetailLinkCols(withCohortCols(withExtraCols(spec.columns)))));
  }
  // deals.contact_id d'une migration récente : retente sans la colonne.
  if (error && /contact_id/.test(error.message) && detailCols.includes(", contact_id")) {
    ({ data, error } = await buildQuery(detailCols.replace(", contact_id", "")));
  }
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  let resolveDim = dimFn;
  let scoped = rows;

  // ── Dimension cohorte : lecture mappée (raw_data de l'objet PORTEUR) sinon
  // colonne canonique companies. Regrouper une entité par une cohorte portée
  // par un AUTRE objet n'a pas de sens → erreur claire.
  if (cohortDimKey) {
    const acc = await resolveCohortAccessor(supabase, orgId, cohortDimKey);
    if (!acc.prop && !acc.col) {
      return { error: `Cohorte inconnue ou non mappée : ${cohortDimKey}. Mappe-la dans Paramètres → Cohortes.` };
    }
    if (acc.prop && acc.object !== entity) {
      return { error: `La cohorte ${cohortDimKey} est portée par l'objet ${acc.object} — regroupe cette entité-là (le filtre cohorte, lui, marche partout).` };
    }
    if (!acc.prop && entity !== "companies") {
      return { error: `La cohorte canonique ${cohortDimKey} est portée par les entreprises.` };
    }
    resolveDim = (r) => {
      if (acc.prop) {
        const rd = r.raw_data as Record<string, unknown> | null;
        const props = rd?.properties as Record<string, unknown> | undefined;
        const v = props?.[acc.prop];
        return v == null || v === "" ? "inconnu" : String(v);
      }
      return String(r[acc.col!] ?? "inconnu");
    };
  }

  // ── Application du filtre cohorte (mêmes règles de lecture que la dim) ──
  // 3 chemins selon l'objet PORTEUR de la cohorte :
  //  1. l'entité elle-même → filtre direct sur ses raw_data/colonnes ;
  //  2. companies → entreprises de la cohorte → jointure company_id / id ;
  //  3. contacts/deals (autre entité) → enregistrements de l'objet qui matchent
  //     → LEURS entreprises → jointure company_id / id.
  if (cohortValue && cohortKey && cohortAcc) {
    const acc = cohortAcc;
    const matchVal = (v: unknown) =>
      cohortValue === "inconnu" ? v == null || v === "" : String(v) === cohortValue;
    if (acc.prop && acc.object === entity) {
      scoped = scoped.filter((r) => {
        const rd = r.raw_data as Record<string, unknown> | null;
        const props = rd?.properties as Record<string, unknown> | undefined;
        return matchVal(props?.[acc.prop!]);
      });
    } else if (!acc.prop || acc.object === "companies") {
      // Entreprises de la cohorte → Set d'ids → jointure JS (company_id / id).
      const target = acc.prop ? `raw_data->properties->>${acc.prop}` : acc.col!;
      let cq = supabase.from("companies").select("id").eq("organization_id", orgId).limit(10000);
      cq = cohortValue === "inconnu" ? cq.is(target, null) : cq.eq(target, cohortValue);
      const { data: comp, error: compErr } = await cq;
      if (compErr) throw new Error(compErr.message);
      const ids = new Set(((comp ?? []) as { id: string }[]).map((c) => c.id));
      scoped = scoped.filter((r) => {
        const cid = entity === "companies" ? r.id : r.company_id;
        return typeof cid === "string" && ids.has(cid);
      });
    } else {
      // Cohorte contacts/deals appliquée à une autre entité : objets matchés →
      // leurs entreprises → jointure company_id. UNION avec le lien DIRECT
      // deal → contact (associations HubSpot, deals.contact_id) pour les
      // cohortes CONTACT sur les tables de deals — indispensable quand le
      // portail n'associe pas les deals aux entreprises.
      const target = `raw_data->properties->>${acc.prop}`;
      let oq = supabase.from(acc.object).select("id, company_id").eq("organization_id", orgId).limit(10000);
      oq = cohortValue === "inconnu" ? oq.is(target, null) : oq.eq(target, cohortValue);
      const { data: objRows, error: objErr } = await oq;
      if (objErr) throw new Error(objErr.message);
      const rowsObj = (objRows ?? []) as { id: string; company_id: string | null }[];
      const companyIds = new Set(
        rowsObj.map((r) => r.company_id).filter((v): v is string => typeof v === "string" && !!v),
      );
      const objectIds = new Set(rowsObj.map((r) => r.id));
      const contactOnDeals = acc.object === "contacts" && entity === "deals";
      scoped = scoped.filter((r) => {
        const cid = entity === "companies" ? r.id : r.company_id;
        const byCompany = typeof cid === "string" && companyIds.has(cid);
        const byContact =
          contactOnDeals && typeof r.contact_id === "string" && objectIds.has(r.contact_id);
        return byCompany || byContact;
      });
    }
  }
  // Probabilité de closing par deal (0..1) pour la mesure « weighted ».
  // Défaut : probabilité de l'étape canonique ; enrichie via HubSpot dans le bloc deals.
  let probResolver: ((r: Record<string, unknown>) => number) | null =
    entity === "deals"
      ? (r) => {
          const p = relNum(r.pipeline_stages, "probability");
          return p != null ? p / 100 : 0;
        }
      : null;
  const wantPipeline = typeof input.pipeline === "string" && input.pipeline.trim() ? input.pipeline.trim() : null;
  const pipelineDim = groupBy === "pipeline" || groupBy === "stage_pipeline";
  // Dims fondées sur le statut gagné/perdu de l'étape : bénéficient aussi du
  // fallback HubSpot quand l'ETL n'a pas mappé dealstage → pipeline_stages.
  const statusDim = groupBy === "status" || groupBy === "outcome" || groupBy === "close_date_state";
  if (entity === "deals" && (groupBy === "stage" || pipelineDim || statusDim || wantPipeline)) {
    // Fallback HubSpot quand l'ETL n'a pas mappé dealstage → pipeline_stages.
    const stageMap = await resolveStageMap(hubspotToken);
    const extOf = (r: Record<string, unknown>) =>
      typeof r.stage_external_id === "string" ? r.stage_external_id : "";
    const stageOf = (r: Record<string, unknown>) => {
      const joined = relName(r.pipeline_stages);
      if (joined !== "Sans étape") return joined;
      return stageMap.get(extOf(r))?.label ?? "Sans étape";
    };
    const pipelineOf = (r: Record<string, unknown>) =>
      relField(r.pipeline_stages, "pipeline_name") ?? stageMap.get(extOf(r))?.pipelineLabel ?? "Sans pipeline";
    const pipelineIdOf = (r: Record<string, unknown>) =>
      relField(r.pipeline_stages, "pipeline_external_id") ?? stageMap.get(extOf(r))?.pipelineId ?? null;

    // Le rattachement au pipeline vient soit du canonique (pipeline_stages
    // mappé par l'ETL), soit de HubSpot en direct. Si AUCUN des deux n'est
    // disponible, on refuse de répondre : filtrer sur un pipeline non résoluble
    // renverrait 0 — un faux chiffre qui déclencherait à tort une alerte
    // « en dessous du seuil ». Mieux vaut « non calculable » (le cron passe).
    if ((wantPipeline || pipelineDim) && rows.length > 0) {
      const resolvable =
        stageMap.size > 0 ||
        rows.some((r) => relField(r.pipeline_stages, "pipeline_external_id") || relField(r.pipeline_stages, "pipeline_name"));
      if (!resolvable) {
        return {
          error:
            "Pipeline non résoluble : ni le mapping canonique (pipeline_stages.pipeline_external_id) ni HubSpot ne sont disponibles. Agrégat refusé plutôt que renvoyer un chiffre faux.",
          hasData: false,
        };
      }
    }

    if (wantPipeline) {
      const want = wantPipeline.toLowerCase();
      scoped = rows.filter(
        (r) => (pipelineIdOf(r) ?? "").toLowerCase() === want || pipelineOf(r).toLowerCase() === want,
      );
    }
    // Statut gagné/perdu : étape canonique d'abord, HubSpot en fallback.
    const wonOf = (r: Record<string, unknown>) =>
      relFlag(r.pipeline_stages, "is_closed_won") || !!stageMap.get(extOf(r))?.closedWon;
    const lostOf = (r: Record<string, unknown>) =>
      relFlag(r.pipeline_stages, "is_closed_lost") || !!stageMap.get(extOf(r))?.closedLost;

    if (groupBy === "stage") resolveDim = stageOf;
    else if (groupBy === "pipeline") resolveDim = pipelineOf;
    else if (groupBy === "stage_pipeline") resolveDim = (r) => `${pipelineOf(r)} › ${stageOf(r)}`;
    else if (groupBy === "status") resolveDim = (r) => dealStatusLabel(wonOf(r), lostOf(r));
    else if (groupBy === "outcome")
      resolveDim = (r) => (wonOf(r) || lostOf(r) ? dealStatusLabel(wonOf(r), lostOf(r)) : null);
    else if (groupBy === "close_date_state")
      resolveDim = (r) => (wonOf(r) || lostOf(r) ? null : closeDateStateLabel(r.close_date));

    // Enrichissement HubSpot de la probabilité quand l'étape canonique ne la porte pas.
    probResolver = (r) => {
      const p = relNum(r.pipeline_stages, "probability");
      if (p != null) return p / 100;
      const hs = stageMap.get(extOf(r));
      return hs ? (Number(hs.probability) || 0) / 100 : 0;
    };
  }

  const isMonth = groupBy.startsWith("month_");
  // Fréquence d'affichage des dimensions temporelles : le bucket est recalculé
  // depuis la vraie colonne de date (jour, semaine ISO, trimestre, semestre, année).
  const granularity: TimeGranularity = (TIME_GRANULARITIES as readonly string[]).includes(String(input.granularity))
    ? (String(input.granularity) as TimeGranularity)
    : "month";
  if (isMonth && granularity !== "month") {
    const col = dateColumnFor(entity, groupBy);
    if (col) resolveDim = (r) => timeBucketOf(r[col], granularity);
  }

  // ── Mode DÉTAIL : les enregistrements du bucket demandé (drill-down), avec
  // exactement le même scoping (sources, période, pipeline) et la même
  // résolution de dimension que l'agrégat. ──
  if (wantDetail) {
    const bucket =
      typeof input.detailBucket === "string" && input.detailBucket !== "" ? input.detailBucket : null;
    const matched = bucket == null ? scoped : scoped.filter((r) => resolveDim(r) === bucket);
    const fields = DETAIL_FIELDS[entity];
    if (!fields) return { error: `Détail non disponible pour l'entité ${entity}.` };
    const LIMIT = 200;
    const sliced = matched.slice(0, LIMIT);
    const columns: DetailColumn[] = fields.map((f) => ({ id: f.id, label: f.label, kind: f.kind, default: f.default }));
    const records: unknown[][] = sliced.map((r) => fields.map((f) => f.value(r)));

    // ── Colonnes COHORTES (Paramètres → Cohortes, objet Entreprise) :
    // suggestions activables dans « Colonnes » du détail — la valeur est lue
    // sur l'entreprise liée à chaque enregistrement (2e requête bornée à 200
    // ids). Sur companies, segment/industry canoniques sont déjà des colonnes :
    // seules les cohortes MAPPÉES s'ajoutent. Best effort : un échec n'enlève
    // rien au détail standard.
    try {
      const cohorts = (await listCompanyCohortAccessors(supabase, orgId)).filter(
        (c) => entity !== "companies" || c.prop,
      );
      const idOf = (r: Record<string, unknown>) =>
        entity === "companies" ? r.id : r.company_id;
      const ids = [...new Set(sliced.map(idOf).filter((v): v is string => typeof v === "string" && !!v))];
      if (cohorts.length > 0 && ids.length > 0) {
        const { data: comps } = await supabase
          .from("companies")
          .select("id, segment, industry, raw_data")
          .eq("organization_id", orgId)
          .in("id", ids);
        const byId = new Map(
          ((comps ?? []) as Array<{ id: string; segment?: unknown; industry?: unknown; raw_data?: unknown }>).map((c) => [c.id, c]),
        );
        const readCohort = (companyId: unknown, c: { prop: string | null; col: string | null }): string => {
          const comp = typeof companyId === "string" ? byId.get(companyId) : null;
          if (!comp) return "—";
          if (c.prop) {
            const props = (comp.raw_data as { properties?: Record<string, unknown> } | null)?.properties;
            const v = props?.[c.prop];
            return v == null || v === "" ? "—" : String(v);
          }
          const v = (comp as Record<string, unknown>)[c.col!];
          return v == null || v === "" ? "—" : String(v);
        };
        for (const c of cohorts) columns.push({ id: `cohort_${c.key}`, label: c.label, kind: "text", default: false });
        sliced.forEach((r, i) => {
          for (const c of cohorts) records[i].push(readCohort(idOf(r), c));
        });
      }
    } catch {
      /* cohortes indisponibles → détail standard inchangé */
    }

    return {
      hasData: matched.length > 0,
      entity,
      groupBy,
      bucket,
      totalRecords: matched.length,
      truncated: matched.length > LIMIT,
      // TOUTES les colonnes du catalogue (default = affichée d'emblée, les
      // cohortes en suggestions) : le client choisit, sans re-requête.
      columns,
      records,
    };
  }

  const acc: Record<string, { sum: number; count: number; weighted: number }> = {};
  for (const r of scoped) {
    const key = resolveDim(r);
    if (key == null || key === "") continue;
    const e = (acc[key] ??= { sum: 0, count: 0, weighted: 0 });
    e.count++;
    if (numFn) e.sum += numFn(r);
    if (measure === "weighted" && numFn && probResolver) e.weighted += numFn(r) * probResolver(r);
  }
  const valueOf = (e: { sum: number; count: number; weighted: number }) =>
    measure === "count"
      ? e.count
      : measure === "weighted"
        ? Math.round(e.weighted)
        : measure === "sum"
          ? Math.round(e.sum)
          : e.count
            ? Math.round(e.sum / e.count)
            : 0;

  let out: { group: string; value: number }[];
  if (isMonth) {
    // Axe continu (buckets vides inclus) quand la plage est bornée ; sinon les
    // clés observées, triées chronologiquement (formats triables par fréquence).
    const keys =
      granularity === "month"
        ? (from && to ? monthKeysBetween(from, to) : monthKeys(months))
        : (from && to ? timeKeysBetween(from, to, granularity) : null) ?? Object.keys(acc).sort();
    out = keys.map((k) => ({ group: k, value: valueOf(acc[k] ?? { sum: 0, count: 0, weighted: 0 }) }));
  } else {
    out = Object.entries(acc)
      .map(([group, e]) => ({ group, value: valueOf(e) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);
  }
  // Outils réellement présents dans le résultat (tables multi-sources) : permet
  // d'afficher la pastille « données croisées » sur les rapports sans filtre.
  const sourcesUsed = spec.hasSource
    ? [...new Set(scoped.map((r) => (typeof r.primary_source === "string" ? r.primary_source : "")).filter(Boolean))]
    : [];
  return {
    hasData: scoped.length > 0,
    entity, groupBy, measure, field: field ?? undefined,
    pipeline: wantPipeline,
    granularity: isMonth ? granularity : undefined,
    rows: out, totalRows: scoped.length,
    sources_used: sourcesUsed.length > 0 ? sourcesUsed : undefined,
    period: from && to ? { from, to } : null,
  };
}

export const aggregateCanonical: AgentTool = {
  def: {
    name: "aggregate_canonical",
    description:
      "Agrégation flexible sur les tables canoniques synchronisées, pour répondre à toute question chiffrée non couverte par un autre outil. Groupe une entité par une dimension et calcule une mesure. " +
      "Entités et dimensions disponibles — deals: month_created, month_closed, stage, pipeline, stage_pipeline, status (En cours/Gagnés/Perdus), outcome (deals clôturés uniquement : Gagnés/Perdus), close_date_state (deals en cours : Dépassée/À jour/Sans close date) (mesures: count, sum/avg de amount) ; invoices: status, source, month_issued, month_paid (count, sum/avg de amount_total/amount_paid/amount_due) ; subscriptions: status, source, month_started, month_canceled (count, sum/avg de mrr) ; transactions (transactions bancaires = paiements réels, même sans facture): month_transaction, direction, category, source (count, sum/avg de amount net signé / amount_in encaissements / amount_out décaissements) ; tickets: status (count) ; companies: segment, industry, country (count) ; contacts: mql, sql (count). " +
      "Renvoie une liste {group, value} prête à visualiser.",
    input_schema: {
      type: "object",
      properties: {
        entity: { type: "string", enum: Object.keys(AGG_SPECS), description: "Table canonique à agréger." },
        groupBy: { type: "string", description: "Dimension de regroupement (voir la liste par entité)." },
        measure: { type: "string", enum: ["count", "sum", "avg"], description: "Mesure (défaut count)." },
        field: { type: "string", description: "Champ numérique pour sum/avg (voir la liste par entité)." },
        months: { type: "integer", description: "Fenêtre en mois pour les dimensions month_* (défaut 12)." },
        date_from: { type: "string", description: "Début de période YYYY-MM-DD (filtre déterministe sur la date de l'entité)." },
        date_to: { type: "string", description: "Fin de période YYYY-MM-DD." },
        pipeline: {
          type: "string",
          description:
            "Deals uniquement : restreint l'agrégat à un seul pipeline (id HubSpot ou nom exact). Indispensable avec groupBy: stage quand plusieurs pipelines partagent des libellés d'étape.",
        },
      },
      required: ["entity", "groupBy"],
    },
  },
  run: async (input, ctx: AgentContext) =>
    computeAggregate(ctx.supabase, ctx.orgId, ctx.sources, ctx.hubspotToken, input as AggregateSpec),
};

/** Liste des sources actuellement connectées à l'org. */
export const listConnectedSources: AgentTool = {
  def: {
    name: "list_connected_sources",
    description:
      "Liste les outils/sources actuellement connectés à Revold pour cette org (CRM, facturation, support…), avec leur catégorie. À utiliser pour savoir quelles sources sont disponibles à croiser.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const tools = await getConnectedTools(ctx.supabase, ctx.orgId);
    return {
      connected: tools.map((t) => ({ key: t.key, label: t.label, category: t.category })),
      selectedByUser: ctx.sources,
    };
  },
};

/** Vue d'ensemble facturation/abonnements (Stripe/Pennylane/HubSpot auto). */
export const getBillingOverview: AgentTool = {
  def: {
    name: "get_billing_overview",
    description:
      "Vue d'ensemble facturation/abonnements : MRR, ARR, taux de churn, abonnements actifs/résiliés, factures payées/impayées, total encaissé, total impayé, facture moyenne. Source résolue automatiquement.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const d = await fetchPaiementFacturationFor(ctx.supabase, ctx.orgId, ctx.hubspotToken);
    return {
      source: d.source,
      hasData: d.hasData,
      mrr: d.mrr,
      arr: d.arr,
      churnRate: d.churnRate,
      activeSubscriptions: d.activeSubsCount,
      canceledSubscriptions: d.canceledSubsCount,
      paidInvoices: d.paidInvoicesCount,
      unpaidInvoices: d.unpaidInvoicesCount,
      totalPaid: d.totalPaid,
      totalUnpaidAmount: d.totalUnpaidAmount,
      avgInvoice: d.avgInvoice,
      currency: "EUR",
    };
  },
};

/** Factures impayées triées par montant dû. */
export const listUnpaidInvoices: AgentTool = {
  def: {
    name: "list_unpaid_invoices",
    description:
      "Liste les factures impayées (solde restant dû > 0) triées par montant décroissant, avec client, montant dû, échéance et jours de retard. Pour le recouvrement / DSO / créances à risque.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Nombre max de factures (défaut 10)." } },
    },
  },
  run: async (input, ctx: AgentContext) => {
    const limit = Math.min(Number(input.limit) || 10, 50);
    let q = ctx.supabase
      .from("invoices")
      .select("number, status, amount_total, amount_due, currency, due_at, primary_source, companies(name)")
      .eq("organization_id", ctx.orgId)
      .gt("amount_due", 0)
      .order("amount_due", { ascending: false })
      .limit(limit);
    const src = billingSourceFilter(ctx.sources);
    if (src) q = q.in("primary_source", src);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0)
      return { hasData: false, note: "Aucune facture impayée dans les tables canoniques pour ces sources." };
    return {
      hasData: true,
      count: rows.length,
      invoices: rows.map((r) => ({
        number: r.number,
        client: companyName(r.companies),
        amountDue: r.amount_due,
        currency: r.currency,
        status: r.status,
        dueDate: r.due_at,
        daysOverdue: daysOverdue(r.due_at as string | null),
        source: r.primary_source,
      })),
    };
  },
};

/** Détail churn : abonnements actifs + résiliations récentes. */
export const getChurnDetail: AgentTool = {
  def: {
    name: "get_churn_detail",
    description:
      "Détail du churn : abonnements actifs, MRR total, et dernières résiliations (client + MRR perdu + date). Pour analyser le churn revenue et le risque de rétention.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Nombre max de résiliations (défaut 10)." } },
    },
  },
  run: async (input, ctx: AgentContext) => {
    const limit = Math.min(Number(input.limit) || 10, 50);
    const src = billingSourceFilter(ctx.sources);
    let activeQ = ctx.supabase
      .from("subscriptions")
      .select("mrr")
      .eq("organization_id", ctx.orgId)
      .eq("status", "active");
    if (src) activeQ = activeQ.in("primary_source", src);
    let canceledQ = ctx.supabase
      .from("subscriptions")
      .select("mrr, canceled_at, primary_source, companies(name)")
      .eq("organization_id", ctx.orgId)
      .eq("status", "canceled")
      .order("canceled_at", { ascending: false })
      .limit(limit);
    if (src) canceledQ = canceledQ.in("primary_source", src);
    const [{ data: active }, { data: canceled }] = await Promise.all([activeQ, canceledQ]);
    const activeRows = (active ?? []) as { mrr: number }[];
    const canceledRows = (canceled ?? []) as unknown as Record<string, unknown>[];
    if (activeRows.length === 0 && canceledRows.length === 0)
      return { hasData: false, note: "Aucun abonnement dans les tables canoniques pour ces sources." };
    return {
      hasData: true,
      activeSubscriptions: activeRows.length,
      totalMrr: activeRows.reduce((s, r) => s + (Number(r.mrr) || 0), 0),
      recentCancellations: canceledRows.map((r) => ({
        client: companyName(r.companies),
        mrrLost: r.mrr,
        canceledAt: r.canceled_at,
        source: r.primary_source,
      })),
    };
  },
};

/** Cross-source : CA CRM signé vs CA facturé. */
export const compareCrmVsBilled: AgentTool = {
  def: {
    name: "compare_crm_vs_billed_revenue",
    description:
      "Analyse cross-source différenciante : compare le CA signé dans le CRM (deals gagnés) au CA réellement facturé (factures). Révèle l'écart entre marqué gagné et facturé. Retourne les deux totaux et l'écart.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data: deals } = await ctx.supabase
      .from("deals")
      .select("amount, pipeline_stages(is_closed_won)")
      .eq("organization_id", ctx.orgId);
    const wonRevenue = ((deals ?? []) as unknown as Record<string, unknown>[])
      .filter((d) => {
        const st = d.pipeline_stages;
        const stage = (Array.isArray(st) ? st[0] : st) as { is_closed_won?: boolean } | null;
        return stage?.is_closed_won === true;
      })
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    let invQ = ctx.supabase.from("invoices").select("amount_total").eq("organization_id", ctx.orgId);
    const src = billingSourceFilter(ctx.sources);
    if (src) invQ = invQ.in("primary_source", src);
    const { data: invoices } = await invQ;
    const billedRevenue = ((invoices ?? []) as { amount_total: number }[]).reduce(
      (s, r) => s + (Number(r.amount_total) || 0),
      0,
    );
    const hasData = wonRevenue > 0 || billedRevenue > 0;
    return {
      hasData,
      crmWonRevenue: wonRevenue,
      billedRevenue,
      gap: wonRevenue - billedRevenue,
      currency: "EUR",
      note: hasData
        ? "CA CRM gagné = somme des deals en étape closed_won. CA facturé = somme des amount_total des factures."
        : "Données deals ou factures absentes des tables canoniques — synchroniser les sources concernées.",
    };
  },
};

/** Rapprochement cross-source : couverture des source_links, entités multi vs mono-source. */
export const getReconciliationStatus: AgentTool = {
  def: {
    name: "get_reconciliation_status",
    description:
      "État du rapprochement (réconciliation) cross-source de l'org : par type d'entité (company, contact, invoice…), combien d'enregistrements sont liés à plusieurs sources (réconciliés) vs une seule source, et la répartition par fournisseur. Pour auditer la qualité du croisement des données et repérer les entités non rapprochées.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data, error } = await ctx.supabase
      .from("source_links")
      .select("provider, entity_type, internal_id")
      .eq("organization_id", ctx.orgId)
      .limit(8000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { provider: string; entity_type: string; internal_id: string }[];
    if (rows.length === 0)
      return {
        hasData: false,
        note: "Aucun source_link : aucune donnée réconciliée cross-source. Connecter/synchroniser au moins 2 sources pour activer le rapprochement.",
      };
    // Regroupe par entité : providers distincts par internal_id.
    const byEntity: Record<string, { providers: Record<string, number>; entities: Map<string, Set<string>> }> = {};
    for (const r of rows) {
      const e = (byEntity[r.entity_type] ??= { providers: {}, entities: new Map() });
      e.providers[r.provider] = (e.providers[r.provider] ?? 0) + 1;
      const set = e.entities.get(r.internal_id) ?? new Set<string>();
      set.add(r.provider);
      e.entities.set(r.internal_id, set);
    }
    const summary = Object.entries(byEntity).map(([entityType, e]) => {
      const total = e.entities.size;
      let multi = 0;
      for (const providers of e.entities.values()) if (providers.size >= 2) multi++;
      return {
        entityType,
        totalEntities: total,
        multiSource: multi,
        monoSource: total - multi,
        reconciledPct: total ? Math.round((multi / total) * 100) : 0,
        byProvider: e.providers,
      };
    });
    const providers = Array.from(new Set(rows.map((r) => r.provider)));
    return { hasData: true, providers, byEntityType: summary, sampledLinks: rows.length };
  },
};

/** Vue d'ensemble support / service client (tickets canoniques). */
export const getSupportOverview: AgentTool = {
  def: {
    name: "get_support_overview",
    description:
      "Vue d'ensemble du service client : nombre total de tickets, répartition ouverts/résolus par statut. Pour analyser la charge support et les signaux de risque de churn.",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data, error } = await ctx.supabase
      .from("tickets")
      .select("status")
      .eq("organization_id", ctx.orgId)
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { status: string | null }[];
    if (rows.length === 0)
      return { hasData: false, note: "Aucun ticket dans les tables canoniques. Connecter/synchroniser un outil support (Zendesk, Intercom…)." };
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const s = (r.status ?? "inconnu").toLowerCase();
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    const openLike = Object.entries(byStatus)
      .filter(([s]) => /open|pending|new|ouvert|en cours/.test(s))
      .reduce((a, [, n]) => a + n, 0);
    return { hasData: true, total: rows.length, open: openLike, byStatus };
  },
};

/**
 * Tool de rendu de rapport (nom réservé "render_report").
 * Capturé par le runtime et rendu par l'UI en graphiques — pas d'exécution
 * serveur. L'agent DOIT d'abord récupérer les vrais chiffres via ses autres
 * outils, puis remplir les blocs avec ces données réelles.
 */
export const renderReportTool: AgentTool = {
  def: {
    name: "render_report",
    description:
      "Construit et affiche un rapport visuel à l'utilisateur (KPIs, graphiques, tables). À utiliser APRÈS avoir récupéré les chiffres réels via tes autres outils. Ne mets JAMAIS de données inventées dans un bloc. Choisis le type de visualisation adapté à chaque donnée (kpi pour une valeur clé, bar/line/area pour une série, donut pour une répartition, table pour un détail). FIABILITÉ : pour CHAQUE bloc dont les data viennent d'aggregate_canonical, ajoute le champ query (mêmes entity/groupBy/measure/field) — indispensable pour que Revold recalcule les vrais chiffres quand l'utilisateur change la période.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du rapport." },
        summary: { type: "string", description: "Synthèse en une ou deux phrases." },
        blocks: {
          type: "array",
          description: "Blocs du rapport, dans l'ordre d'affichage.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["kpi", "bar", "line", "area", "donut", "table"],
                description: "Type de bloc / visualisation.",
              },
              title: { type: "string", description: "Titre du bloc (graphiques/tables)." },
              label: { type: "string", description: "Libellé (bloc kpi)." },
              value: { type: "string", description: "Valeur formatée (bloc kpi), ex '124 500 €'." },
              hint: { type: "string", description: "Précision courte (bloc kpi)." },
              data: {
                type: "array",
                description: "Points de données (bar/line/area/donut).",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["name", "value"],
                },
              },
              columns: { type: "array", items: { type: "string" }, description: "En-têtes (table)." },
              rows: {
                type: "array",
                description: "Lignes (table), chaque ligne = tableau de cellules texte.",
                items: { type: "array", items: { type: "string" } },
              },
              query: {
                type: "object",
                description: "FIABILITÉ : si les data du bloc viennent d'aggregate_canonical, mets ici les mêmes entity/groupBy/measure/field pour permettre le recalcul déterministe par période.",
                properties: {
                  entity: { type: "string" },
                  groupBy: { type: "string" },
                  measure: { type: "string", enum: ["count", "sum", "avg"] },
                  field: { type: "string" },
                },
                required: ["entity", "groupBy"],
              },
            },
            required: ["type"],
          },
        },
      },
      required: ["title", "blocks"],
    },
  },
};

/**
 * Tool de proposition de graphique (nom réservé "propose_chart").
 * Capturé par le runtime : l'agent fournit la donnée réelle + les types
 * suggérés, l'UI affiche des icônes de type et rend le graphe au choix de
 * l'utilisateur. Pour un rapport multi-blocs figé, utiliser render_report.
 */
export const proposeChartTool: AgentTool = {
  def: {
    name: "propose_chart",
    description:
      "Propose à l'utilisateur de CHOISIR le type de graphique (barres, courbe, aire, donut, table) pour une donnée. À utiliser dès qu'un graphique est demandé et que plusieurs visualisations conviennent : récupère d'abord la vraie donnée via tes outils, puis fournis-la ici avec les types suggérés — l'utilisateur clique l'icône et l'UI rend le graphe. IMPORTANT FIABILITÉ : si la donnée provient d'aggregate_canonical, fournis TOUJOURS le champ `query` avec les MÊMES entity/groupBy/measure/field — cela permet à Revold de recalculer les vrais chiffres quand l'utilisateur change la période (sinon le changement de période est impossible). Pour un rapport figé multi-blocs, utilise render_report à la place.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du graphique." },
        summary: { type: "string", description: "Contexte en une phrase (optionnel)." },
        data: {
          type: "array",
          description: "Les points de données réels à visualiser.",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "number" } },
            required: ["name", "value"],
          },
        },
        suggestedTypes: {
          type: "array",
          description: "Types de graphique adaptés à cette donnée.",
          items: { type: "string", enum: ["bar", "line", "area", "donut", "table"] },
        },
        defaultType: { type: "string", enum: ["bar", "line", "area", "donut", "table"], description: "Type mis en avant par défaut." },
        query: {
          type: "object",
          description: "Requête aggregate_canonical qui a produit la donnée (pour recalcul déterministe par période). Mets les mêmes valeurs que ton appel aggregate_canonical.",
          properties: {
            entity: { type: "string" },
            groupBy: { type: "string" },
            measure: { type: "string", enum: ["count", "sum", "avg"] },
            field: { type: "string" },
          },
          required: ["entity", "groupBy"],
        },
      },
      required: ["title", "data"],
    },
  },
};

/** Fabrique le tool d'action confirmable (nom réservé "propose_action"). */
export function proposeActionTool(categories: string[]): AgentTool {
  return {
    def: {
      name: "propose_action",
      description:
        "Propose une action de suivi à l'utilisateur (créer une alerte pour surveiller un KPI, un risque, un objectif). NE l'exécute PAS : l'utilisateur devra confirmer. À utiliser en fin d'analyse quand un suivi a du sens.",
      input_schema: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["create_alert"] },
          title: { type: "string", description: "Titre court de l'alerte." },
          description: { type: "string", description: "Ce qui doit être surveillé et pourquoi." },
          category: { type: "string", enum: categories, description: "Catégorie de l'alerte." },
          impact: { type: "string", description: "Impact business attendu, quantifié si possible." },
        },
        required: ["action_type", "title", "description"],
      },
    },
  };
}
