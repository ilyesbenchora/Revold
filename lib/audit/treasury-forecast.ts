import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashflowData } from "./cashflow";
import { expandFiscalSchedule, type FiscalScheduleItem, type OrgFiscalParams } from "./fiscal-schedule";
import { getForecastExcludedPipelines } from "@/lib/actions/engine";

/**
 * Prévisionnel de trésorerie glissant (12 mois, 3 scénarios) — adapté du
 * template Lomed Cockpit au modèle canonique multi-tenant de Revold :
 *
 *  - encaissements = activité RÉCURRENTE saisonnalisée (médiane des
 *    encaissements réels mêlée au même mois de l'an passé — c'est elle qui
 *    donne aux courbes leur relief mois par mois, au lieu d'une rampe droite)
 *    + factures clients OUVERTES à leur échéance
 *    + pipeline CRM pondéré (probabilité d'étape × décote d'inactivité),
 *    projeté au mois de clôture + 1 (on encaisse APRÈS avoir livré).
 *    Anti double compte : le récurrent est un COMPLÉMENT — il ne s'ajoute que
 *    pour la part au-dessus des factures déjà émises pour le mois ;
 *  - décaissements = charges saisonnalisées (même principe, médiane × an −1)
 *    en complément des factures fournisseurs ouvertes à leur échéance
 *    + échéances fiscales (paramètres de l'organisation, Paramètres → Organisation) ;
 *  - point de départ = trésorerie disponible réelle (continuité avec la courbe réelle).
 *
 * Scénarios : Prudent = récurrent ralenti (80 %) SANS pipeline ·
 * Probable = récurrent + pipeline pondéré · Ambitieux = récurrent + pipeline plein.
 *
 * Contrairement au template (hypothèses d'une seule entreprise codées en dur),
 * TOUT est piloté par les données synchronisées et les paramètres de l'org.
 */

export type ForecastPoint = {
  month: string; // YYYY-MM
  label: string; // "juil. 2026"
  encaissementsFactures: number;
  /** Activité récurrente projetée (complément saisonnalisé, hors factures déjà émises). */
  encaissementsRecurrents: number;
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
  /** Pipelines exclus de la projection (validés dans la Boîte Actions). */
  excludedPipelines: string[];
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
  //    de leur étape réelle × décote d'inactivité. Les pipelines EXCLUS de la
  //    projection (Boîte Actions — ex. financement/club deals hors d'échelle)
  //    sont filtrés ici, et uniquement ici. ──
  const excludedPipelines = await getForecastExcludedPipelines(supabase, orgId);
  const excludedSet = new Set(excludedPipelines);
  const { data: dealRows } = await supabase
    .from("deals")
    .select("name, amount, close_date, last_contacted_at, is_closed_won, is_closed_lost, pipeline_stages(name, probability, is_closed_won, is_closed_lost, pipeline_name)")
    .eq("organization_id", orgId)
    .not("amount", "is", null)
    .limit(5000);
  type DealRow = {
    name: string | null; amount: number; close_date: string | null; last_contacted_at: string | null;
    is_closed_won: boolean; is_closed_lost: boolean;
    pipeline_stages: { name: string | null; probability: number | null; is_closed_won: boolean | null; is_closed_lost: boolean | null; pipeline_name: string | null } | Array<{ name: string | null; probability: number | null; is_closed_won: boolean | null; is_closed_lost: boolean | null; pipeline_name: string | null }> | null;
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
    if (st?.pipeline_name && excludedSet.has(st.pipeline_name.trim())) continue; // pipeline exclu de la projection
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

  // ── Activité récurrente saisonnalisée (le relief des courbes) ──
  // Base mensuelle = moyenne (médiane des encaissements réels, même mois an −1).
  // Sans historique du mois miroir → médiane seule. C'est un COMPLÉMENT : il
  // ne compte que pour la part au-dessus des factures/échéances déjà connues
  // du mois (sinon on compterait deux fois le même euro).
  const histo = new Map((cf?.monthlyFlows ?? []).map((f) => [f.month, { in: f.in, out: f.out }]));
  const medianOf = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  // Mois en cours exclu (partiel) — il fausserait la médiane vers le bas.
  const fullMonths = (cf?.monthlyFlows ?? []).filter((f) => f.month !== currentMonth);
  const medianeEnc = medianOf(fullMonths.map((f) => f.in).filter((v) => v > 0));
  const seasonalBase = (m: string, mediane: number | null, pick: (h: { in: number; out: number }) => number): number => {
    const mirror = histo.get(addMonths(m, -12));
    const lastYear = mirror ? pick(mirror) : null;
    if (mediane != null && lastYear != null && lastYear > 0) return (mediane + lastYear) / 2;
    return mediane ?? (lastYear != null && lastYear > 0 ? lastYear : 0);
  };
  // Prudent : activité récurrente ralentie (80 %), zéro pipeline.
  const PRUDENT_RECURRENT = 0.8;

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

    // Récurrent (complément au-dessus des factures émises) et charges
    // saisonnalisées (complément au-dessus des fournisseurs + fiscal connus).
    const encRecurrent = Math.max(0, seasonalBase(m, medianeEnc, (h) => h.in) - encFactures);
    const decCharges = Math.max(0, seasonalBase(m, charges, (h) => h.out) - decFournisseurs - decFiscal);
    const outflows = decCharges + decFournisseurs + decFiscal;

    prudent += encFactures + encRecurrent * PRUDENT_RECURRENT - outflows; // sans pipeline
    probable += encFactures + encRecurrent + encPipelineProbable - outflows;
    ambitieux += encFactures + encRecurrent + encPipelinePlein - outflows;

    if (breakEvenMonth.prudent === null && prudent < 0) breakEvenMonth.prudent = m;
    if (breakEvenMonth.probable === null && probable < 0) breakEvenMonth.probable = m;
    if (breakEvenMonth.ambitieux === null && ambitieux < 0) breakEvenMonth.ambitieux = m;

    points.push({
      month: m,
      label: monthLabel(m),
      encaissementsFactures: Math.round(encFactures),
      encaissementsRecurrents: Math.round(encRecurrent),
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
    excludedPipelines,
  };
}
