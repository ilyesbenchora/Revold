/**
 * P&L et balance générale reconstruits depuis `ledger_balances`
 * (écritures comptables agrégées compte × mois à la sync — Pennylane & co).
 *
 * Conventions PCG :
 *   - comptes 7 (produits)  : solde = crédit − débit
 *   - comptes 6 (charges)   : solde = débit − crédit
 *   - résultat = produits − charges ; taux de marge = résultat / produits
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PnlAccountRow = { account: string; label: string | null; total: number };

export type PnlData = {
  hasData: boolean;
  produits: number;       // CA + autres produits (classe 7)
  charges: number;        // charges (classe 6)
  resultat: number;
  tauxMarge: number | null; // %
  topCharges: PnlAccountRow[];
  /** Balance synthétique par classe de comptes (1..7) : solde débit − crédit. */
  balanceParClasse: Array<{ classe: string; label: string; debit: number; credit: number; solde: number }>;
};

const CLASSE_LABELS: Record<string, string> = {
  "1": "Capitaux",
  "2": "Immobilisations",
  "3": "Stocks",
  "4": "Tiers (clients/fournisseurs/État)",
  "5": "Financier (banque/caisse)",
  "6": "Charges",
  "7": "Produits",
  "8": "Comptes spéciaux",
};

export async function computePnl(
  supabase: SupabaseClient,
  orgId: string,
  toolKey: string,
): Promise<PnlData> {
  const { data, error } = await supabase
    .from("ledger_balances")
    .select("account_number, account_label, debit, credit")
    .eq("organization_id", orgId)
    .eq("primary_source", toolKey)
    .limit(10000);

  const rows = error ? [] : data ?? [];
  const empty: PnlData = {
    hasData: false, produits: 0, charges: 0, resultat: 0, tauxMarge: null, topCharges: [], balanceParClasse: [],
  };
  if (rows.length === 0) return empty;

  let produits = 0;
  let charges = 0;
  const chargesByAccount = new Map<string, { label: string | null; total: number }>();
  const byClasse = new Map<string, { debit: number; credit: number }>();

  for (const r of rows) {
    const num = String(r.account_number ?? "");
    const classe = num[0];
    if (!classe) continue;
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;

    const c = byClasse.get(classe) ?? { debit: 0, credit: 0 };
    c.debit += debit;
    c.credit += credit;
    byClasse.set(classe, c);

    if (classe === "7") produits += credit - debit;
    if (classe === "6") {
      const total = debit - credit;
      charges += total;
      const cur = chargesByAccount.get(num) ?? { label: r.account_label ?? null, total: 0 };
      cur.total += total;
      if (!cur.label && r.account_label) cur.label = r.account_label;
      chargesByAccount.set(num, cur);
    }
  }

  const resultat = produits - charges;
  const tauxMarge = produits > 0 ? Math.round((resultat / produits) * 100) : null;

  const topCharges = [...chargesByAccount.entries()]
    .map(([account, v]) => ({ account, label: v.label, total: Math.round(v.total) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const balanceParClasse = [...byClasse.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([classe, v]) => ({
      classe,
      label: CLASSE_LABELS[classe] ?? `Classe ${classe}`,
      debit: Math.round(v.debit),
      credit: Math.round(v.credit),
      solde: Math.round(v.debit - v.credit),
    }));

  return {
    hasData: true,
    produits: Math.round(produits),
    charges: Math.round(charges),
    resultat: Math.round(resultat),
    tauxMarge,
    topCharges,
    balanceParClasse,
  };
}
