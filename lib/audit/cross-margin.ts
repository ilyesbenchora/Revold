/**
 * Croisement CRM × Facturation : marge et prévisions.
 *
 * Apparaît quand la sélection de sources couvre `deals` (CRM) + `invoices`
 * (facturation). Calculs :
 *   - CA signé          = somme des deals gagnés (CRM canonique)
 *   - CA encaissé       = factures payées de l'outil de facturation
 *   - Marge brute       = CA encaissé − décaissements (si cashflow dispo)
 *   - Taux de marge     = marge / CA encaissé
 *   - Pipeline pondéré  = somme(montant × probabilité) des deals ouverts
 *   - Prévision de marge = pipeline pondéré × taux de marge courant
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CrossMarginData = {
  hasDeals: boolean;
  caSigne: number;
  dealsGagnesCount: number;
  pipelinePondere: number;
  caEncaisse: number;
  decaissements: number | null;
  margeBrute: number | null;
  tauxMarge: number | null; // en %
  previsionMarge: number | null;
  ecartSigneEncaisse: number;
};

export async function computeCrossMargin(
  supabase: SupabaseClient,
  orgId: string,
  args: {
    /** CA encaissé de l'outil de facturation sélectionné (totalPaid). */
    caEncaisse: number;
    /** Décaissements (cashflow) si l'outil les fournit, sinon null. */
    decaissements: number | null;
  },
): Promise<CrossMarginData> {
  const [{ data: wonDeals }, { data: openDeals }] = await Promise.all([
    supabase
      .from("deals")
      .select("amount")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .gt("amount", 0)
      .limit(5000),
    supabase
      .from("deals")
      .select("amount, win_probability")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .gt("amount", 0)
      .limit(5000),
  ]);

  const won = wonDeals ?? [];
  const open = openDeals ?? [];
  const caSigne = won.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const pipelinePondere = Math.round(
    open.reduce((s, d) => s + (Number(d.amount) || 0) * (Number(d.win_probability) || 0.5), 0),
  );

  const { caEncaisse, decaissements } = args;
  const margeBrute = decaissements != null ? caEncaisse - decaissements : null;
  const tauxMarge =
    margeBrute != null && caEncaisse > 0 ? Math.round((margeBrute / caEncaisse) * 100) : null;
  const previsionMarge =
    tauxMarge != null ? Math.round((pipelinePondere * tauxMarge) / 100) : null;

  return {
    hasDeals: won.length > 0 || open.length > 0,
    caSigne,
    dealsGagnesCount: won.length,
    pipelinePondere,
    caEncaisse,
    decaissements,
    margeBrute,
    tauxMarge,
    previsionMarge,
    ecartSigneEncaisse: caSigne - caEncaisse,
  };
}
