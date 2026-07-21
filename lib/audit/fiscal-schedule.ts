import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fiscal & social — échéancier 12 mois + provision de TVA courante.
 *
 * Esprit du template Lomed Cockpit (TVA CA12, acomptes IS, URSSAF) mais piloté
 * par les PARAMÈTRES de l'organisation (Paramètres → Organisation → Fiscalité),
 * jamais par des hypothèses codées en dur : Revold est multi-tenant.
 *
 * Ces montants sont des AIDES À LA DÉCISION, pas des déclarations officielles —
 * à confirmer avec l'expert-comptable (même prudence que le template).
 */

export type OrgFiscalParams = {
  fiscal_tva_periodicite?: string | null;
  fiscal_tva_prochaine?: string | null;
  fiscal_tva_montant?: number | null;
  fiscal_is_periodicite?: string | null;
  fiscal_is_prochaine?: string | null;
  fiscal_is_montant?: number | null;
  fiscal_urssaf_periodicite?: string | null;
  fiscal_urssaf_prochaine?: string | null;
  fiscal_urssaf_montant?: number | null;
};

export type FiscalScheduleItem = {
  month: string; // YYYY-MM
  label: string; // "TVA (acompte CA12 55 %)"
  amount: number;
};

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const addM = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
};

/** Pas de récurrence (en mois) déduit du texte libre de périodicité. */
function stepOf(periodicite: string | null | undefined): number | null {
  const p = (periodicite ?? "").toLowerCase();
  if (/mensu/.test(p)) return 1;
  if (/trimest/.test(p)) return 3;
  if (/semest/.test(p)) return 6;
  if (/annu|ca12/.test(p)) return 12;
  return null;
}

/**
 * Occurrences d'une taxe sur l'horizon, ancrées sur la prochaine échéance
 * saisie. Cas particulier CA12 (TVA annuelle, régime réel simplifié) : au lieu
 * d'un unique paiement annuel, on projette le calendrier légal — acompte de
 * 55 % en juillet, 40 % en décembre, solde (~5 %) en mai — à partir du montant
 * annuel saisi.
 */
function expandOne(
  label: string,
  periodicite: string | null | undefined,
  prochaine: string | null | undefined,
  montant: number | null | undefined,
  now: Date,
  horizon: number,
): FiscalScheduleItem[] {
  const amount = Math.round(Number(montant) || 0);
  if (amount <= 0) return [];
  const current = monthKey(now);
  const months = new Set(Array.from({ length: horizon }, (_, i) => addM(current, i + 1)));

  const isCa12 = /ca12/i.test(periodicite ?? "") || (/annu/.test((periodicite ?? "").toLowerCase()) && label === "TVA");
  if (isCa12) {
    // Calendrier CA12 pour chaque année couverte par l'horizon.
    const out: FiscalScheduleItem[] = [];
    const years = new Set([now.getUTCFullYear(), now.getUTCFullYear() + 1]);
    for (const y of years) {
      const entries: Array<[string, string, number]> = [
        [`${y}-07`, "TVA (acompte CA12 55 %)", Math.round(amount * 0.55)],
        [`${y}-12`, "TVA (acompte CA12 40 %)", Math.round(amount * 0.4)],
        [`${y + 1}-05`, "TVA (solde CA12)", Math.round(amount * 0.05)],
      ];
      for (const [m, l, a] of entries) if (months.has(m)) out.push({ month: m, label: l, amount: a });
    }
    return out;
  }

  const step = stepOf(periodicite);
  if (!step) return [];
  // Ancre : la prochaine échéance saisie, sinon le mois prochain.
  let anchor = prochaine ? monthKey(new Date(prochaine)) : addM(current, 1);
  if (Number.isNaN(new Date(`${anchor}-01`).getTime())) anchor = addM(current, 1);
  while (anchor <= current) anchor = addM(anchor, step);

  const out: FiscalScheduleItem[] = [];
  for (let m = anchor; months.has(m) || m <= addM(current, horizon); m = addM(m, step)) {
    if (months.has(m)) out.push({ month: m, label, amount });
    if (out.length > horizon) break;
  }
  return out;
}

/** Échéancier fiscal complet (TVA + IS + URSSAF) sur l'horizon. */
export function expandFiscalSchedule(org: OrgFiscalParams | null, now: Date, horizon = 12): FiscalScheduleItem[] {
  const o = org ?? {};
  return [
    ...expandOne("TVA", o.fiscal_tva_periodicite, o.fiscal_tva_prochaine, o.fiscal_tva_montant, now, horizon),
    ...expandOne("IS (acompte)", o.fiscal_is_periodicite, o.fiscal_is_prochaine, o.fiscal_is_montant, now, horizon),
    ...expandOne("URSSAF", o.fiscal_urssaf_periodicite, o.fiscal_urssaf_prochaine, o.fiscal_urssaf_montant, now, horizon),
  ].sort((a, b) => a.month.localeCompare(b.month));
}

export type TvaProvision = {
  hasData: boolean;
  collectee: number; // TVA contenue dans les encaissements (20/120 du TTC)
  deductible: number; // TVA contenue dans les décaissements
  provision: number; // collectée − déductible (si > 0 : à provisionner)
  moisCouverts: number;
};

/**
 * Provision de TVA estimée depuis les FLUX BANCAIRES réels (année en cours) :
 * TVA collectée ≈ 20/120 des encaissements TTC, TVA déductible ≈ 20/120 des
 * décaissements TTC. Approximation volontairement simple (taux unique 20 %,
 * tous les flux supposés assujettis) — c'est un ordre de grandeur pour
 * provisionner, pas une déclaration.
 */
export async function computeTvaProvision(supabase: SupabaseClient, orgId: string): Promise<TvaProvision> {
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const { data } = await supabase
    .from("bank_transactions")
    .select("amount, date")
    .eq("organization_id", orgId)
    .gte("date", yearStart)
    .limit(10000);
  const rows = (data ?? []) as Array<{ amount: number; date: string | null }>;
  if (rows.length === 0) return { hasData: false, collectee: 0, deductible: 0, provision: 0, moisCouverts: 0 };

  const TVA_PART = 0.2 / 1.2; // part de TVA dans un TTC à 20 %
  let inTtc = 0, outTtc = 0;
  const monthsSeen = new Set<string>();
  for (const r of rows) {
    const a = Number(r.amount) || 0;
    if (a > 0) inTtc += a;
    else outTtc += Math.abs(a);
    if (r.date) monthsSeen.add(String(r.date).slice(0, 7));
  }
  const collectee = Math.round(inTtc * TVA_PART);
  const deductible = Math.round(outTtc * TVA_PART);
  return {
    hasData: true,
    collectee,
    deductible,
    provision: collectee - deductible,
    moisCouverts: monthsSeen.size,
  };
}
