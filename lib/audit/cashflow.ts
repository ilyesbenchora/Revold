/**
 * Cashflow canonique d'un outil comptable (Pennylane, …).
 *
 * Calculé depuis les tables Supabase `invoices` synchronisées :
 *   - encaissements  = factures clients payées   (direction 'in')
 *   - décaissements  = factures fournisseurs payées (direction 'out')
 *
 * En dérivent les blocs Trésorerie :
 *   - balance                = encaissements − décaissements (période)
 *   - charges fixes          = médiane des décaissements mensuels (6 derniers mois)
 *   - trésorerie disponible  = cumul TTC des flux synchronisés (estimation)
 *   - trésorerie consolidée  = disponible + placements (placements non synchronisés → null)
 *   - runway                 = trésorerie disponible / charges fixes (mois)
 *
 * Si la migration `invoices.direction` n'est pas appliquée, on retombe sur
 * encaissements seuls (décaissements = 0) sans casser la page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CashflowData = {
  hasData: boolean;
  /** Migration direction appliquée + factures fournisseurs présentes. */
  hasOutflows: boolean;
  encaissementsTotal: number;
  decaissementsTotal: number;
  balance: number;
  /** Médiane des décaissements mensuels (6 derniers mois). */
  chargesFixesMensuelles: number | null;
  /** Cumul TTC (enc − déc) des flux synchronisés — estimation, pas un solde bancaire. */
  tresorerieDisponibleEstimee: number | null;
  /** Disponible + placements (placements non synchronisés pour l'instant). */
  tresorerieConsolidee: number | null;
  /** Mois de survie sans nouveau revenu = dispo / charges fixes. */
  runwayMois: number | null;
};

type Row = { amount_paid: number | null; paid_at: string | null; direction?: string | null };

async function fetchPaidInvoices(
  supabase: SupabaseClient,
  orgId: string,
  toolKey: string,
): Promise<{ rows: Row[]; directionAvailable: boolean }> {
  // Tentative avec la colonne direction (migration appliquée).
  const withDir = await supabase
    .from("invoices")
    .select("amount_paid, paid_at, direction")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .gt("amount_paid", 0)
    .limit(5000);
  if (!withDir.error) return { rows: (withDir.data ?? []) as Row[], directionAvailable: true };

  // Migration absente → toutes les factures payées comptent en encaissements.
  const noDir = await supabase
    .from("invoices")
    .select("amount_paid, paid_at")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .gt("amount_paid", 0)
    .limit(5000);
  return { rows: (noDir.data ?? []) as Row[], directionAvailable: false };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function computeCashflow(
  supabase: SupabaseClient,
  orgId: string,
  toolKey: string,
  now: Date = new Date(),
): Promise<CashflowData> {
  const { rows, directionAvailable } = await fetchPaidInvoices(supabase, orgId, toolKey);

  const inflows = rows.filter((r) => (r.direction ?? "in") !== "out");
  const outflows = directionAvailable ? rows.filter((r) => r.direction === "out") : [];

  const encaissementsTotal = inflows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
  const decaissementsTotal = outflows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
  const hasData = rows.length > 0;
  const hasOutflows = outflows.length > 0;

  // Charges fixes : médiane des décaissements des 6 derniers mois PLEINS.
  let chargesFixesMensuelles: number | null = null;
  if (hasOutflows) {
    const byMonth = new Map<string, number>();
    for (const r of outflows) {
      if (!r.paid_at) continue;
      const d = new Date(r.paid_at);
      if (Number.isNaN(d.getTime())) continue;
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo < 0 || monthsAgo > 6) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(r.amount_paid) || 0));
    }
    chargesFixesMensuelles = median([...byMonth.values()]);
  }

  const tresorerieDisponibleEstimee = hasData ? encaissementsTotal - decaissementsTotal : null;
  // Placements non synchronisés pour l'instant → consolidée = disponible.
  const tresorerieConsolidee = tresorerieDisponibleEstimee;
  const runwayMois =
    tresorerieDisponibleEstimee != null && chargesFixesMensuelles != null && chargesFixesMensuelles > 0
      ? Math.max(0, Math.round((tresorerieDisponibleEstimee / chargesFixesMensuelles) * 10) / 10)
      : null;

  return {
    hasData,
    hasOutflows,
    encaissementsTotal,
    decaissementsTotal,
    balance: encaissementsTotal - decaissementsTotal,
    chargesFixesMensuelles,
    tresorerieDisponibleEstimee,
    tresorerieConsolidee,
    runwayMois,
  };
}
