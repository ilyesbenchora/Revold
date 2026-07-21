/**
 * Cashflow canonique d'un outil comptable (Pennylane, …).
 *
 * Deux sources, par ordre de priorité :
 *  1. `bank_transactions` (flux bancaires réels synchronisés, montants signés)
 *     + `bank_accounts.balance` (solde bancaire RÉEL au moment de la sync)
 *  2. Repli : tables `invoices` (factures clients payées = encaissements,
 *     factures fournisseurs payées = décaissements via `direction`)
 *
 * En dérivent les blocs Trésorerie :
 *   - balance                = encaissements − décaissements (flux synchronisés)
 *   - charges fixes          = médiane des décaissements mensuels (6 derniers mois)
 *   - trésorerie disponible  = somme des soldes bancaires réels, sinon cumul des flux
 *   - trésorerie consolidée  = disponible + placements (non synchronisés → = disponible)
 *   - runway                 = trésorerie disponible / charges fixes (mois)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CashflowData = {
  hasData: boolean;
  /** Des décaissements sont réellement mesurés (flux négatifs ou factures fournisseurs). */
  hasOutflows: boolean;
  /** D'où vient la trésorerie disponible : solde bancaire réel ou cumul de flux. */
  balanceSource: "bank" | "flux" | null;
  encaissementsTotal: number;
  decaissementsTotal: number;
  balance: number;
  chargesFixesMensuelles: number | null;
  tresorerieDisponible: number | null;
  tresorerieConsolidee: number | null;
  runwayMois: number | null;
};

type Flow = { amount: number; date: string | null }; // amount > 0 = encaissement

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Flux depuis bank_transactions (montants signés). [] si table absente/vide. */
async function fetchBankFlows(supabase: SupabaseClient, orgId: string, toolKey: string): Promise<Flow[]> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("amount, date")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .limit(10000);
  if (error) return [];
  return (data ?? []).map((r) => ({ amount: Number(r.amount) || 0, date: r.date as string | null }));
}

/** Solde bancaire réel : somme des balances des comptes synchronisés. */
async function fetchBankBalance(supabase: SupabaseClient, orgId: string, toolKey: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey);
  if (error || !data || data.length === 0) return null;
  return data.reduce((s, r) => s + (Number(r.balance) || 0), 0);
}

/** Repli : flux depuis les factures payées (clients 'in', fournisseurs 'out'). */
async function fetchInvoiceFlows(supabase: SupabaseClient, orgId: string, toolKey: string): Promise<Flow[]> {
  const withDir = await supabase
    .from("invoices")
    .select("amount_paid, paid_at, direction")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .gt("amount_paid", 0)
    .limit(5000);
  const rows = withDir.error
    ? (await supabase
        .from("invoices")
        .select("amount_paid, paid_at")
        .eq("organization_id", orgId)
        .eq("primary_source", toolKey)
        .gt("amount_paid", 0)
        .limit(5000)).data ?? []
    : withDir.data ?? [];
  return (rows as Array<{ amount_paid: number | null; paid_at: string | null; direction?: string | null }>).map((r) => ({
    amount: (r.direction === "out" ? -1 : 1) * (Number(r.amount_paid) || 0),
    date: r.paid_at,
  }));
}

export async function computeCashflow(
  supabase: SupabaseClient,
  orgId: string,
  toolKey: string,
  now: Date = new Date(),
): Promise<CashflowData> {
  // 1. Flux bancaires réels d'abord ; 2. repli factures payées.
  let flows = await fetchBankFlows(supabase, orgId, toolKey);
  if (flows.length === 0) flows = await fetchInvoiceFlows(supabase, orgId, toolKey);
  const bankBalance = await fetchBankBalance(supabase, orgId, toolKey);

  const encaissementsTotal = flows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  const outflows = flows.filter((f) => f.amount < 0);
  const decaissementsTotal = outflows.reduce((s, f) => s + Math.abs(f.amount), 0);
  const hasData = flows.length > 0 || bankBalance != null;
  const hasOutflows = outflows.length > 0;

  // Charges fixes : médiane des décaissements des 6 derniers mois.
  let chargesFixesMensuelles: number | null = null;
  if (hasOutflows) {
    const byMonth = new Map<string, number>();
    for (const f of outflows) {
      if (!f.date) continue;
      const d = new Date(f.date);
      if (Number.isNaN(d.getTime())) continue;
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo < 0 || monthsAgo > 6) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + Math.abs(f.amount));
    }
    chargesFixesMensuelles = median([...byMonth.values()]);
  }

  // Trésorerie disponible : solde bancaire réel si synchronisé, sinon cumul des flux.
  const tresorerieDisponible =
    bankBalance != null ? bankBalance : hasData ? encaissementsTotal - decaissementsTotal : null;
  const balanceSource: CashflowData["balanceSource"] =
    bankBalance != null ? "bank" : hasData ? "flux" : null;
  // Placements non synchronisés pour l'instant → consolidée = disponible.
  const tresorerieConsolidee = tresorerieDisponible;
  const runwayMois =
    tresorerieDisponible != null && chargesFixesMensuelles != null && chargesFixesMensuelles > 0
      ? Math.max(0, Math.round((tresorerieDisponible / chargesFixesMensuelles) * 10) / 10)
      : null;

  return {
    hasData,
    hasOutflows,
    balanceSource,
    encaissementsTotal,
    decaissementsTotal,
    balance: encaissementsTotal - decaissementsTotal,
    chargesFixesMensuelles,
    tresorerieDisponible,
    tresorerieConsolidee,
    runwayMois,
  };
}
