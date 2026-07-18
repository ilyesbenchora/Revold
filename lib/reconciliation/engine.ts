import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Moteur de réconciliation cross-source — Phase 2.
 *
 * Contrairement à `computeAggregate` (mono-entité) et à `compareCrmVsBilled`
 * (deux SUM indépendantes), ce moteur fait de VRAIES jointures ligne-à-ligne
 * sur `company_id` (peuplé par la Phase 1) entre CRM (deals), facturation
 * (invoices/subscriptions) et support (tickets).
 *
 * Chaque recette renvoie UN chiffre réconcilié + une COUVERTURE ∈ [0,1] (part
 * des lignes réellement reliées). La couverture sert de gate de fiabilité :
 * une alerte ne se déclenche pas sur une jointure trop peu couverte (faux 0).
 */

export type ReconResult = { value: number; coverage: number; hasData: boolean };
export type ReconRecipe = {
  id: string;
  label: string;
  unit: "currency" | "percent" | "count";
  /** Ce que mesure la recette (aide l'agent à choisir). */
  desc: string;
  compute: (sb: SupabaseClient, orgId: string) => Promise<ReconResult>;
};

const ACTIVE_SUB = ["active", "trialing"];
const UNPAID_STATUS = ["open", "unpaid", "past_due", "uncollectible"];

async function selectAll<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  apply: (q: ReturnType<SupabaseClient["from"]>) => unknown,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 20; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb.from(table).select(columns).range(page * 1000, page * 1000 + 999);
    q = apply(q) ?? q;
    const { data, error } = await q;
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

type DealRow = { amount: number | null; company_id: string | null };
type InvRow = { amount_total: number | null; amount_paid: number | null; amount_due: number | null; status: string | null; company_id: string | null };
type SubRow = { mrr: number | null; status: string | null; company_id: string | null };

async function wonDeals(sb: SupabaseClient, orgId: string): Promise<DealRow[]> {
  return selectAll<DealRow>(sb, "deals", "amount, company_id", (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq("organization_id", orgId).eq("is_closed_won", true));
}
async function invoices(sb: SupabaseClient, orgId: string): Promise<InvRow[]> {
  return selectAll<InvRow>(sb, "invoices", "amount_total, amount_paid, amount_due, status, company_id", (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq("organization_id", orgId));
}
async function activeSubs(sb: SupabaseClient, orgId: string): Promise<SubRow[]> {
  return selectAll<SubRow>(sb, "subscriptions", "mrr, status, company_id", (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq("organization_id", orgId).in("status", ACTIVE_SUB));
}
async function openTicketCompanies(sb: SupabaseClient, orgId: string): Promise<Set<string>> {
  const rows = await selectAll<{ company_id: string | null }>(sb, "tickets", "company_id", (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq("organization_id", orgId).is("closed_at", null));
  const s = new Set<string>();
  for (const r of rows) if (r.company_id) s.add(r.company_id);
  return s;
}

const sum = (rows: Array<{ v: number | null }>) => rows.reduce((s, r) => s + (r.v || 0), 0);

export const RECON_RECIPES: Record<string, ReconRecipe> = {
  crm_vs_billed_gap: {
    id: "crm_vs_billed_gap",
    label: "Écart CA signé ↔ facturé",
    unit: "currency",
    desc: "CA des deals gagnés (CRM) moins CA facturé (factures). Écart de réconciliation.",
    async compute(sb, orgId) {
      const [deals, invs] = await Promise.all([wonDeals(sb, orgId), invoices(sb, orgId)]);
      const won = sum(deals.map((d) => ({ v: d.amount })));
      const billed = sum(invs.map((i) => ({ v: i.amount_total })));
      const wonCompanies = new Set(deals.map((d) => d.company_id).filter(Boolean) as string[]);
      const invCompanies = new Set(invs.map((i) => i.company_id).filter(Boolean) as string[]);
      const inter = [...wonCompanies].filter((c) => invCompanies.has(c)).length;
      const coverage = wonCompanies.size > 0 ? inter / wonCompanies.size : 0;
      return { value: Math.round(won - billed), coverage, hasData: deals.length + invs.length > 0 };
    },
  },

  revenue_leakage: {
    id: "revenue_leakage",
    label: "Fuite de revenu (deals gagnés non facturés)",
    unit: "currency",
    desc: "Montant des deals gagnés dont l'entreprise n'a AUCUNE facture — jointure sur company_id.",
    async compute(sb, orgId) {
      const [deals, invs] = await Promise.all([wonDeals(sb, orgId), invoices(sb, orgId)]);
      const invCompanies = new Set(invs.map((i) => i.company_id).filter(Boolean) as string[]);
      const linked = deals.filter((d) => d.company_id);
      const leakage = sum(linked.filter((d) => !invCompanies.has(d.company_id as string)).map((d) => ({ v: d.amount })));
      const coverage = deals.length > 0 ? linked.length / deals.length : 0;
      return { value: Math.round(leakage), coverage, hasData: deals.length > 0 };
    },
  },

  arr_reconciled: {
    id: "arr_reconciled",
    label: "ARR (abonnements actifs × 12)",
    unit: "currency",
    desc: "Somme des MRR des abonnements actifs × 12. Couverture = part reliée à une entreprise.",
    async compute(sb, orgId) {
      const subs = await activeSubs(sb, orgId);
      const mrr = sum(subs.map((s) => ({ v: s.mrr })));
      const linked = subs.filter((s) => s.company_id).length;
      const coverage = subs.length > 0 ? linked / subs.length : 0;
      return { value: Math.round(mrr * 12), coverage, hasData: subs.length > 0 };
    },
  },

  mrr_reconciled: {
    id: "mrr_reconciled",
    label: "MRR (abonnements actifs)",
    unit: "currency",
    desc: "Somme des MRR des abonnements actifs.",
    async compute(sb, orgId) {
      const subs = await activeSubs(sb, orgId);
      const mrr = sum(subs.map((s) => ({ v: s.mrr })));
      const linked = subs.filter((s) => s.company_id).length;
      const coverage = subs.length > 0 ? linked / subs.length : 0;
      return { value: Math.round(mrr), coverage, hasData: subs.length > 0 };
    },
  },

  billed_paid: {
    id: "billed_paid",
    label: "CA encaissé (factures payées)",
    unit: "currency",
    desc: "Somme des montants encaissés (amount_paid des factures).",
    async compute(sb, orgId) {
      const invs = await invoices(sb, orgId);
      const paid = sum(invs.map((i) => ({ v: i.amount_paid })));
      const linked = invs.filter((i) => i.company_id).length;
      const coverage = invs.length > 0 ? linked / invs.length : 0;
      return { value: Math.round(paid), coverage, hasData: invs.length > 0 };
    },
  },

  unpaid_amount: {
    id: "unpaid_amount",
    label: "Impayés (montant dû)",
    unit: "currency",
    desc: "Somme des montants dus des factures ouvertes/impayées.",
    async compute(sb, orgId) {
      const invs = await invoices(sb, orgId);
      const unpaid = invs.filter((i) => (i.status && UNPAID_STATUS.includes(i.status)) || (i.amount_due ?? 0) > 0);
      const due = sum(unpaid.map((i) => ({ v: i.amount_due })));
      const linked = invs.filter((i) => i.company_id).length;
      const coverage = invs.length > 0 ? linked / invs.length : 0;
      return { value: Math.round(due), coverage, hasData: invs.length > 0 };
    },
  },

  mrr_at_risk: {
    id: "mrr_at_risk",
    label: "MRR à risque (comptes avec ticket ouvert)",
    unit: "currency",
    desc: "MRR des abonnements dont l'entreprise a un ticket support ouvert — jointure subscriptions↔tickets sur company_id.",
    async compute(sb, orgId) {
      const [subs, riskCompanies] = await Promise.all([activeSubs(sb, orgId), openTicketCompanies(sb, orgId)]);
      const atRisk = sum(subs.filter((s) => s.company_id && riskCompanies.has(s.company_id)).map((s) => ({ v: s.mrr })));
      const linked = subs.filter((s) => s.company_id).length;
      const coverage = subs.length > 0 ? linked / subs.length : 0;
      return { value: Math.round(atRisk), coverage, hasData: subs.length > 0 };
    },
  },

  reconciled_pct: {
    id: "reconciled_pct",
    label: "% de données réconciliées (multi-source)",
    unit: "percent",
    desc: "Part des entités reliées à ≥2 outils (source_links). Mesure la qualité de la réconciliation.",
    async compute(sb, orgId) {
      const rows = await selectAll<{ internal_id: string; provider: string }>(sb, "source_links", "internal_id, provider", (q) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q as any).eq("organization_id", orgId));
      const byInternal = new Map<string, Set<string>>();
      for (const r of rows) {
        if (!byInternal.has(r.internal_id)) byInternal.set(r.internal_id, new Set());
        byInternal.get(r.internal_id)!.add(r.provider);
      }
      const total = byInternal.size;
      const multi = [...byInternal.values()].filter((s) => s.size >= 2).length;
      const pct = total > 0 ? Math.round((multi / total) * 100) : 0;
      return { value: pct, coverage: 1, hasData: total > 0 };
    },
  },
};

export function getReconRecipe(id?: string | null): ReconRecipe | null {
  return id ? RECON_RECIPES[id] ?? null : null;
}

/** Calcule un chiffre réconcilié + couverture pour une recette. */
export async function computeReconciledMetric(
  sb: SupabaseClient,
  orgId: string,
  recipeId: string,
): Promise<ReconResult | null> {
  const recipe = getReconRecipe(recipeId);
  if (!recipe) return null;
  try {
    return await recipe.compute(sb, orgId);
  } catch {
    return null;
  }
}
