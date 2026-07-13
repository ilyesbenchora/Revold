import type { AgentTool, AgentContext } from "./agent-runtime";
import { fetchPaiementFacturationFor } from "@/lib/audit/paiement-facturation-data";
import { getConnectedTools } from "@/lib/integrations/connected-tools";

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
      "Répartit les deals par étape de pipeline : nombre, montant total et montant pondéré par la probabilité de l'étape. Étapes ordonnées. Pour analyser la structure du pipeline, la couverture, et alimenter un graphique par étape (funnel/bar).",
    input_schema: { type: "object", properties: {} },
  },
  run: async (_input, ctx: AgentContext) => {
    const { data, error } = await ctx.supabase
      .from("deals")
      .select("amount, pipeline_stages(name, position, probability, is_closed_won, is_closed_lost)")
      .eq("organization_id", ctx.orgId)
      .limit(8000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0) return { hasData: false, note: "Aucun deal dans la table canonique." };
    const byStage: Record<string, { position: number; deals: number; amount: number; weighted: number; closed: boolean }> = {};
    for (const r of rows) {
      const st = (Array.isArray(r.pipeline_stages) ? r.pipeline_stages[0] : r.pipeline_stages) as
        | { name?: string; position?: number; probability?: number; is_closed_won?: boolean; is_closed_lost?: boolean }
        | null;
      const name = st?.name ?? "Sans étape";
      const prob = (Number(st?.probability) || 0) / 100;
      const e = (byStage[name] ??= {
        position: Number(st?.position) || 99,
        deals: 0,
        amount: 0,
        weighted: 0,
        closed: !!(st?.is_closed_won || st?.is_closed_lost),
      });
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
      "Construit et affiche un rapport visuel à l'utilisateur (KPIs, graphiques, tables). À utiliser APRÈS avoir récupéré les chiffres réels via tes autres outils. Ne mets JAMAIS de données inventées dans un bloc. Choisis le type de visualisation adapté à chaque donnée (kpi pour une valeur clé, bar/line/area pour une série, donut pour une répartition, table pour un détail).",
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
            },
            required: ["type"],
          },
        },
      },
      required: ["title", "blocks"],
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
