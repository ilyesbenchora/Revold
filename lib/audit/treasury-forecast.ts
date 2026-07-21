import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashflowData } from "./cashflow";
import { expandFiscalSchedule, type FiscalScheduleItem, type OrgFiscalParams } from "./fiscal-schedule";

/**
 * Prévisionnel de trésorerie glissant (12 mois, 3 scénarios) — adapté du
 * template Lomed Cockpit au modèle canonique multi-tenant de Revold :
 *
 *  - encaissements = factures clients OUVERTES à leur échéance
 *    + pipeline CRM pondéré (probabilité d'étape × décote d'inactivité),
 *    projeté au mois de clôture + 1 (on encaisse APRÈS avoir livré) ;
 *  - décaissements = charges fixes mensuelles (médiane des flux réels)
 *    + factures fournisseurs ouvertes à leur échéance
 *    + échéances fiscales (paramètres de l'organisation, Paramètres → Organisation) ;
 *  - point de départ = trésorerie disponible réelle (continuité avec la courbe réelle).
 *
 * Contrairement au template (hypothèses d'une seule entreprise codées en dur),
 * TOUT est piloté par les données synchronisées et les paramètres de l'org.
 */

export type ForecastPoint = {
  month: string; // YYYY-MM
  label: string; // "juil. 2026"
  encaissementsFactures: number;
  encaissementsPipeline: number; // scénario probable
  decaissementsCharges: number;
  decaissementsFournisseurs: number;
  decaissementsFiscal: number;
  soldePrudent: number;
  soldeProbable: number;
  soldeAmbitieux: number;
};

export type ForecastDealRow = {
  name: string;
  amount: number;
  weighted: number;
  probability: number; // 0..1 (étape × décote)
  cashMonth: string;
  stage: string | null;
};

export type TreasuryForecast = {
  hasData: boolean;
  start: number | null;
  points: ForecastPoint[];
  /** Mois où le solde probable passe sous zéro (null = jamais sur l'horizon). */
  breakEvenMonth: { prudent: string | null; probable: string | null; ambitieux: string | null };
  pipelineTotal: number;
  pipelineWeighted: number;
  dealsRetenus: ForecastDealRow[];
  dealsSansMontant: number;
  facturesOuvertes: number;
  fournisseursOuverts: number;
  fiscalTotal: number;
  chargesMensuelles: number | null;
  fiscalItems: FiscalScheduleItem[];
};

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_FR[m - 1]} ${y}`;
}

/**
 * Décote d'inactivité d'un deal (idée du template) : un deal sans activité
 * récente vaut moins que sa probabilité d'étape. 100 % jusqu'à 7 j, décroissance
 * linéaire jusqu'à un plancher de 20 % après 60 j sans contact. Sans info
 * d'activité → pas de décote (on s'en remet à la probabilité d'étape).
 */
export function inactivityDecay(lastContactedAt: string | null): number {
  if (!lastContactedAt) return 1;
  const days = (Date.now() - new Date(lastContactedAt).getTime()) / 86_400_000;
  if (Number.isNaN(days) || days <= 7) return 1;
  if (days >= 60) return 0.2;
  return 1 - ((days - 7) / (60 - 7)) * 0.8;
}

/** Échéance d'une facture → mois de projection (retard → 1er mois projeté). */
function dueMonth(dueAt: string | null, issuedAt: string | null, currentMonth: string): string {
  const raw = dueAt ?? issuedAt;
  const k = raw ? monthKey(new Date(raw)) : currentMonth;
  return k <= currentMonth ? addMonths(currentMonth, 1) : k;
}

export async function computeTreasuryForecast(
  supabase: SupabaseClient,
  orgId: string,
  cf: CashflowData | null,
  org: OrgFiscalParams | null,
  horizon = 12,
): Promise<TreasuryForecast> {
  const now = new Date();
  const currentMonth = monthKey(now);
  const months = Array.from({ length: horizon }, (_, i) => addMonths(currentMonth, i + 1));

  // ── Factures ouvertes (clients + fournisseurs), durcies contre les pièges
  //    du template : montants négatifs (avoirs) en valeur absolue, statuts
  //    clos/annulés exclus. ──
  const { data: openInv } = await supabase
    .from("invoices")
    .select("amount_due, due_at, issued_at, status, direction")
    .eq("organization_id", orgId)
    .in("status", ["open", "uncollectible"])
    .limit(5000);
  const invoices = (openInv ?? []) as Array<{ amount_due: number; due_at: string | null; issued_at: string | null; status: string; direction: string }>;
  const clients = invoices.filter((i) => i.direction !== "out");
  const fournisseurs = invoices.filter((i) => i.direction === "out");

  // ── Pipeline CRM : deals OUVERTS avec montant, pondérés par la probabilité
  //    de leur étape réelle × décote d'inactivité. ──
  const { data: dealRows } = await supabase
    .from("deals")
    .select("name, amount, close_date, last_contacted_at, is_closed_won, is_closed_lost, pipeline_stages(name, probability, is_closed_won, is_closed_lost)")
    .eq("organization_id", orgId)
    .not("amount", "is", null)
    .limit(5000);
  type DealRow = {
    name: string | null; amount: number; close_date: string | null; last_contacted_at: string | null;
    is_closed_won: boolean; is_closed_lost: boolean;
    pipeline_stages: { name: string | null; probability: number | null; is_closed_won: boolean | null; is_closed_lost: boolean | null } | Array<{ name: string | null; probability: number | null; is_closed_won: boolean | null; is_closed_lost: boolean | null }> | null;
  };
  const rel = (d: DealRow) => (Array.isArray(d.pipeline_stages) ? d.pipeline_stages[0] : d.pipeline_stages) ?? null;

  let dealsSansMontant = 0;
  {
    const { count } = await supabase
      .from("deals").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).is("amount", null);
    dealsSansMontant = count ?? 0;
  }

  const dealsRetenus: ForecastDealRow[] = [];
  for (const d of (dealRows ?? []) as DealRow[]) {
    const st = rel(d);
    const closed = d.is_closed_won || d.is_closed_lost || st?.is_closed_won || st?.is_closed_lost;
    if (closed) continue; // le gagné est déjà (ou sera) une facture ; le perdu ne rapporte rien
    const amount = Number(d.amount) || 0;
    if (amount <= 0) continue;
    const stageProb = st?.probability != null ? Math.min(100, Math.max(0, Number(st.probability))) / 100 : 0.3;
    const probability = stageProb * inactivityDecay(d.last_contacted_at);
    // Mois d'encaissement = clôture + 1 (retard plafonné au mois courant avant le +1).
    const closeK = d.close_date ? monthKey(new Date(d.close_date)) : currentMonth;
    const cashMonth = addMonths(closeK < currentMonth ? currentMonth : closeK, 1);
    dealsRetenus.push({
      name: d.name ?? "(deal sans nom)",
      amount,
      weighted: amount * probability,
      probability,
      cashMonth,
      stage: st?.name ?? null,
    });
  }

  // ── Échéances fiscales sur l'horizon (paramètres org, occurrences étendues). ──
  const fiscalItems = expandFiscalSchedule(org, now, horizon);

  // ── Construction des points mensuels ──
  const charges = cf?.chargesFixesMensuelles ?? null;
  const start = cf?.tresorerieDisponible ?? null;
  const sumBy = <T,>(rows: T[], month: string, key: (r: T) => string, val: (r: T) => number) =>
    rows.filter((r) => key(r) === month).reduce((s, r) => s + val(r), 0);

  let prudent = start ?? 0, probable = start ?? 0, ambitieux = start ?? 0;
  const points: ForecastPoint[] = [];
  const breakEvenMonth: TreasuryForecast["breakEvenMonth"] = { prudent: null, probable: null, ambitieux: null };

  for (const m of months) {
    const encFactures = sumBy(clients, m, (r) => dueMonth(r.due_at, r.issued_at, currentMonth), (r) => Math.abs(Number(r.amount_due) || 0));
    const encPipelineProbable = sumBy(dealsRetenus, m, (r) => r.cashMonth, (r) => r.weighted);
    const encPipelinePlein = sumBy(dealsRetenus, m, (r) => r.cashMonth, (r) => r.amount);
    const decFournisseurs = sumBy(fournisseurs, m, (r) => dueMonth(r.due_at, r.issued_at, currentMonth), (r) => Math.abs(Number(r.amount_due) || 0));
    const decFiscal = sumBy(fiscalItems, m, (r) => r.month, (r) => r.amount);
    const decCharges = charges ?? 0;
    const outflows = decCharges + decFournisseurs + decFiscal;

    prudent += encFactures - outflows; // factures seules, zéro pipeline
    probable += encFactures + encPipelineProbable - outflows;
    ambitieux += encFactures + encPipelinePlein - outflows;

    if (breakEvenMonth.prudent === null && prudent < 0) breakEvenMonth.prudent = m;
    if (breakEvenMonth.probable === null && probable < 0) breakEvenMonth.probable = m;
    if (breakEvenMonth.ambitieux === null && ambitieux < 0) breakEvenMonth.ambitieux = m;

    points.push({
      month: m,
      label: monthLabel(m),
      encaissementsFactures: Math.round(encFactures),
      encaissementsPipeline: Math.round(encPipelineProbable),
      decaissementsCharges: Math.round(decCharges),
      decaissementsFournisseurs: Math.round(decFournisseurs),
      decaissementsFiscal: Math.round(decFiscal),
      soldePrudent: Math.round(prudent),
      soldeProbable: Math.round(probable),
      soldeAmbitieux: Math.round(ambitieux),
    });
  }

  const pipelineTotal = dealsRetenus.reduce((s, d) => s + d.amount, 0);
  const pipelineWeighted = dealsRetenus.reduce((s, d) => s + d.weighted, 0);

  return {
    hasData: start !== null || clients.length > 0 || dealsRetenus.length > 0,
    start: start !== null ? Math.round(start) : null,
    points,
    breakEvenMonth,
    pipelineTotal: Math.round(pipelineTotal),
    pipelineWeighted: Math.round(pipelineWeighted),
    dealsRetenus: dealsRetenus.sort((a, b) => b.weighted - a.weighted),
    dealsSansMontant,
    facturesOuvertes: clients.length,
    fournisseursOuverts: fournisseurs.length,
    fiscalTotal: Math.round(fiscalItems.reduce((s, f) => s + f.amount, 0)),
    chargesMensuelles: charges !== null ? Math.round(charges) : null,
    fiscalItems,
  };
}
