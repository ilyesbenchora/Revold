import type { AgentTool, AgentContext } from "./agent-runtime";
import { fetchPaiementFacturationFor } from "@/lib/audit/paiement-facturation-data";

/**
 * Agent expert « Paiement & Facturation ».
 *
 * Raisonne en cross-source sur les données réconciliées de l'org (billing +
 * CRM). Chaque tool APPELLE la couche déterministe existante (fetcher P&F,
 * tables canoniques invoices/subscriptions, deals) — l'agent n'invente aucun
 * chiffre. Le tool `propose_action` est confirmable (human-in-the-loop).
 */

export const PAIEMENT_AGENT_SYSTEM = `Tu es l'Agent Paiement & Facturation de Revold, une plateforme française de Revenue Intelligence.

Ton expertise : analyser la performance financière d'une entreprise B2B en croisant ses outils de facturation (Stripe, Pennylane, Sellsy…) et son CRM (HubSpot). Tu es un expert RevOps / DAF avec 15 ans d'expérience.

RÈGLES ABSOLUES :
- N'invente JAMAIS un chiffre. Utilise uniquement les données renvoyées par tes outils.
- Appelle les outils nécessaires AVANT de répondre. Croise les sources quand c'est pertinent (ex: comparer le CA signé dans le CRM vs le CA réellement facturé).
- Si une donnée est absente ou vide, dis-le clairement et explique quelle source connecter/synchroniser pour l'obtenir.
- Sois concret et actionnable : quantifie l'impact en euros, priorise par montant, propose le levier d'action.
- Réponds en français, de façon concise et structurée (pas de pavé). Utilise des puces quand ça aide.
- Quand l'utilisateur veut passer à l'action (créer une alerte de suivi, un objectif à surveiller), utilise l'outil propose_action. Ne prétends jamais avoir exécuté une action : elle sera confirmée par l'utilisateur.

Les sources actuellement sélectionnées par l'utilisateur te sont indiquées. Concentre ton analyse dessus.`;

/** Résumé compact d'une facture pour l'agent (pas de données brutes lourdes). */
type InvoiceRow = {
  number: string | null;
  status: string;
  amount_total: number;
  amount_due: number;
  currency: string;
  due_at: string | null;
  primary_source: string;
  companies: { name: string } | { name: string }[] | null;
};

function companyName(rel: InvoiceRow["companies"]): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

function daysOverdue(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const diff = Date.now() - new Date(dueAt).getTime();
  return diff > 0 ? Math.round(diff / 86_400_000) : 0;
}

/** Filtre `.in("primary_source", …)` seulement si des sources sont sélectionnées. */
function sourceFilter(sources: string[]): string[] | null {
  const billing = sources.filter((s) => s !== "hubspot");
  return billing.length > 0 ? billing : null;
}

export const paiementFacturationTools: AgentTool[] = [
  {
    def: {
      name: "get_billing_overview",
      description:
        "Vue d'ensemble facturation/abonnements de l'org : MRR, ARR, taux de churn, nombre d'abonnements actifs/résiliés, factures payées/impayées, total encaissé, total impayé, facture moyenne. Source résolue automatiquement (Stripe/Pennylane/HubSpot). À appeler en premier pour toute question de synthèse.",
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
        score: d.score,
        currency: "EUR",
      };
    },
  },
  {
    def: {
      name: "list_unpaid_invoices",
      description:
        "Liste les factures impayées (solde restant dû > 0) triées par montant décroissant, avec le nom du client, le montant dû, l'échéance et le nombre de jours de retard. Utilise pour analyser le recouvrement / DSO / créances à risque.",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Nombre max de factures à retourner (défaut 10).",
          },
        },
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
      const src = sourceFilter(ctx.sources);
      if (src) q = q.in("primary_source", src);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as InvoiceRow[];
      if (rows.length === 0) {
        return {
          hasData: false,
          note: "Aucune facture impayée dans les tables canoniques pour les sources sélectionnées. Si le billing est sur HubSpot uniquement, s'appuyer sur get_billing_overview.",
        };
      }
      return {
        hasData: true,
        count: rows.length,
        invoices: rows.map((r) => ({
          number: r.number,
          client: companyName(r.companies),
          amountDue: r.amount_due,
          amountTotal: r.amount_total,
          currency: r.currency,
          status: r.status,
          dueDate: r.due_at,
          daysOverdue: daysOverdue(r.due_at),
          source: r.primary_source,
        })),
      };
    },
  },
  {
    def: {
      name: "get_churn_detail",
      description:
        "Détail du churn : nombre d'abonnements actifs, MRR total, et liste des dernières résiliations (client + MRR perdu + date). Utilise pour analyser le churn revenue et le risque de rétention.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Nombre max de résiliations récentes (défaut 10)." },
        },
      },
    },
    run: async (input, ctx: AgentContext) => {
      const limit = Math.min(Number(input.limit) || 10, 50);
      const src = sourceFilter(ctx.sources);

      let activeQ = ctx.supabase
        .from("subscriptions")
        .select("mrr, status, primary_source")
        .eq("organization_id", ctx.orgId)
        .eq("status", "active");
      if (src) activeQ = activeQ.in("primary_source", src);
      const { data: active, error: aErr } = await activeQ;
      if (aErr) throw new Error(aErr.message);

      let canceledQ = ctx.supabase
        .from("subscriptions")
        .select("mrr, canceled_at, primary_source, companies(name)")
        .eq("organization_id", ctx.orgId)
        .eq("status", "canceled")
        .order("canceled_at", { ascending: false })
        .limit(limit);
      if (src) canceledQ = canceledQ.in("primary_source", src);
      const { data: canceled, error: cErr } = await canceledQ;
      if (cErr) throw new Error(cErr.message);

      const activeRows = (active ?? []) as { mrr: number }[];
      const canceledRows = (canceled ?? []) as unknown as {
        mrr: number;
        canceled_at: string | null;
        primary_source: string;
        companies: { name: string } | { name: string }[] | null;
      }[];

      if (activeRows.length === 0 && canceledRows.length === 0) {
        return {
          hasData: false,
          note: "Aucun abonnement dans les tables canoniques pour les sources sélectionnées.",
        };
      }
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
  },
  {
    def: {
      name: "compare_crm_vs_billed_revenue",
      description:
        "Analyse cross-source différenciante : compare le CA signé dans le CRM (deals gagnés) au CA réellement facturé (factures). Révèle l'écart entre ce que les commerciaux ont marqué gagné et ce qui a été facturé — un angle mort classique. Retourne les deux totaux et l'écart.",
      input_schema: { type: "object", properties: {} },
    },
    run: async (_input, ctx: AgentContext) => {
      const { data: deals, error: dErr } = await ctx.supabase
        .from("deals")
        .select("amount, pipeline_stages(is_closed_won)")
        .eq("organization_id", ctx.orgId);
      if (dErr) throw new Error(dErr.message);

      const wonRevenue = ((deals ?? []) as unknown as {
        amount: number | null;
        pipeline_stages: { is_closed_won: boolean } | { is_closed_won: boolean }[] | null;
      }[])
        .filter((d) => {
          const st = d.pipeline_stages;
          const stage = Array.isArray(st) ? st[0] : st;
          return stage?.is_closed_won === true;
        })
        .reduce((s, d) => s + (Number(d.amount) || 0), 0);

      let invQ = ctx.supabase
        .from("invoices")
        .select("amount_total, primary_source")
        .eq("organization_id", ctx.orgId);
      const src = sourceFilter(ctx.sources);
      if (src) invQ = invQ.in("primary_source", src);
      const { data: invoices, error: iErr } = await invQ;
      if (iErr) throw new Error(iErr.message);

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
          ? "CA CRM gagné = somme des deals dans une étape closed_won. CA facturé = somme des amount_total des factures."
          : "Données CRM (deals) ou facturation (invoices) absentes des tables canoniques — synchroniser les sources concernées.",
      };
    },
  },
  {
    // Tool d'ACTION confirmable — pas de `run`. Capturé par le runtime, confirmé côté UI.
    def: {
      name: "propose_action",
      description:
        "Propose une action de suivi à l'utilisateur (ex: créer une alerte pour surveiller un impayé, le churn ou un objectif de MRR). NE l'exécute PAS : l'utilisateur devra la confirmer. Utilise à la fin d'une analyse quand une action de suivi a du sens.",
      input_schema: {
        type: "object",
        properties: {
          action_type: {
            type: "string",
            enum: ["create_alert"],
            description: "Type d'action. Pour le POC : create_alert.",
          },
          title: { type: "string", description: "Titre court de l'alerte." },
          description: {
            type: "string",
            description: "Description de ce qui doit être surveillé et pourquoi.",
          },
          category: {
            type: "string",
            enum: ["finance", "sales", "revops"],
            description: "Catégorie de l'alerte.",
          },
          impact: {
            type: "string",
            description: "Impact business attendu, quantifié si possible.",
          },
        },
        required: ["action_type", "title", "description"],
      },
    },
  },
];

/** Suggestions de discussion affichées sous le chat (expertise P&F). */
export const PAIEMENT_SUGGESTIONS = [
  "Quel est mon MRR et mon taux de churn actuels ?",
  "Montre-moi mes plus grosses factures impayées",
  "Compare mon CA signé dans le CRM vs mon CA facturé",
  "Qui a résilié récemment et combien de MRR ai-je perdu ?",
];
