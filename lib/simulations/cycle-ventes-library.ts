/**
 * Cycle de Ventes — Bibliothèque de simulations SMART contextuelles.
 *
 * Architecture FACTORY :
 *   - 1 SimFactory = { id, match(ctx), build(ctx) }
 *   - Chaque factory a un id UNIQUE → zéro doublon possible
 *   - match(ctx) décide si la simulation est pertinente pour la sélection courante
 *   - build(ctx) produit la SmartSimulation finale avec valeurs réelles
 *
 * Le contexte enrichi expose :
 *   - pipelineType inféré (new_business / renewal / upsell / other)
 *   - selectionType (single_early / single_mid / single_late / single_closed /
 *     multi / all)
 *   - byStage avec stageCategory (early/mid/late/closed_won/closed_lost)
 *   - data signals (atRisk, stagnant, cycle, etc.)
 *
 * Résultat : pour chaque combinaison pipeline × stages × data, l'utilisateur
 * voit un set unique de 6-15 simulations vraiment différenciées.
 */

import type { PipelineInfo, PipelineStage } from "@/lib/integrations/hubspot-snapshot";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type DealLite = {
  id: string;
  amount: number;
  closedate: string | null;
  dealstage: string;
  probability: number;
  notes_last_contacted: string | null;
  notes_next_activity_date: string | null;
  createdate: string | null;
  is_closed: boolean;
  is_won: boolean;
};

export type StageCategory = "early" | "mid" | "late" | "closed_won" | "closed_lost";
export type PipelineType = "new_business" | "renewal" | "upsell" | "other";
export type SelectionType =
  | "single_early"
  | "single_mid"
  | "single_late"
  | "single_closed_won"
  | "single_closed_lost"
  | "multi_open"
  | "multi_with_closed"
  | "all";

export type StageMetrics = {
  stageId: string;
  stageLabel: string;
  probability: number;
  closedWon: boolean;
  closedLost: boolean;
  category: StageCategory;

  count: number;
  amount: number;
  weightedAmount: number;
  avgAmount: number;

  atRiskCount: number;
  atRiskAmount: number;
  stagnantCount: number;
  stagnantAmount: number;
  noNextActivityCount: number;

  avgDaysInStage: number;
};

export type PipelineSelectionContext = {
  pipeline: PipelineInfo;
  pipelineType: PipelineType;
  selectedStages: PipelineStage[];
  isAllStagesSelected: boolean;
  selectionType: SelectionType;

  // Aggregates
  totalDeals: number;
  totalAmount: number;
  totalWeightedAmount: number;
  avgDealAmount: number;

  openDeals: number;
  openAmount: number;
  wonDeals: number;
  wonAmount: number;
  lostDeals: number;
  lostAmount: number;
  closingRate: number;

  atRiskCount: number;
  atRiskAmount: number;
  stagnantCount: number;
  stagnantAmount: number;
  noNextActivityCount: number;

  forecastNext30Days: number;
  forecastNext90Days: number;
  forecastNextQuarterAmount: number;

  avgCycleDays: number;

  byStage: StageMetrics[];
};

export type SmartSimulation = {
  id: string; // factory id — garantit unicité
  title: string;
  description: string;
  impact: string;
  category: "sales" | "csm" | "marketing" | "data";
  simulationCategory: "cycle_ventes";
  section: "velocity" | "risk" | "forecast" | "analytics";
  color: string;
  forecastType: string;
  threshold: number;
  direction: "above" | "below";
  pipelineId: string;
  pipelineLabel: string;
  selectedStageIds: string[];
};

type SimFactory = {
  id: string;
  section: "velocity" | "risk" | "forecast" | "analytics";
  match: (ctx: PipelineSelectionContext) => boolean;
  build: (ctx: PipelineSelectionContext) => Omit<SmartSimulation, "id" | "section" | "simulationCategory" | "pipelineId" | "pipelineLabel" | "selectedStageIds">;
};

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const fmtK = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M€`
    : n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

function inferPipelineType(label: string): PipelineType {
  const l = label.toLowerCase();
  if (l.includes("renewal") || l.includes("renouvel") || l.includes("retention")) return "renewal";
  if (l.includes("upsell") || l.includes("expansion") || l.includes("cross")) return "upsell";
  if (l.includes("new") || l.includes("acqui") || l.includes("ventes") || l.includes("sales") || l.includes("prospect")) return "new_business";
  return "other";
}

function categorizeStage(stage: PipelineStage): StageCategory {
  if (stage.closedWon) return "closed_won";
  if (stage.closedLost) return "closed_lost";
  if (stage.probability < 30) return "early";
  if (stage.probability < 70) return "mid";
  return "late";
}

function determineSelectionType(stages: PipelineStage[], allCount: number): SelectionType {
  if (stages.length === allCount) return "all";
  const cats = new Set(stages.map(categorizeStage));
  if (stages.length === 1) {
    const c = categorizeStage(stages[0]);
    if (c === "early") return "single_early";
    if (c === "mid") return "single_mid";
    if (c === "late") return "single_late";
    if (c === "closed_won") return "single_closed_won";
    return "single_closed_lost";
  }
  if (cats.has("closed_won") || cats.has("closed_lost")) return "multi_with_closed";
  return "multi_open";
}

function stageScope(ctx: PipelineSelectionContext): string {
  if (ctx.isAllStagesSelected) return `Pipeline « ${ctx.pipeline.label} » — toutes étapes`;
  if (ctx.selectedStages.length === 1) return `Pipeline « ${ctx.pipeline.label} » — étape « ${ctx.selectedStages[0].label} »`;
  return `Pipeline « ${ctx.pipeline.label} » — ${ctx.selectedStages.length} étapes (${ctx.selectedStages.map(s => s.label).join(" + ")})`;
}

// ────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// ────────────────────────────────────────────────────────────────────────────

export function buildPipelineSelectionContext(
  pipeline: PipelineInfo,
  allDeals: DealLite[],
  selectedStageIds: string[],
): PipelineSelectionContext {
  const isAllStagesSelected = selectedStageIds.length === 0;
  const selectedStages = isAllStagesSelected
    ? pipeline.stages
    : pipeline.stages.filter((s) => selectedStageIds.includes(s.id));
  const stageIdsSet = new Set(selectedStages.map((s) => s.id));
  const dealsInSelection = allDeals.filter((d) => stageIdsSet.has(d.dealstage));

  const now = Date.now();
  const byStage: StageMetrics[] = selectedStages.map((stage) => {
    const dealsInStage = dealsInSelection.filter((d) => d.dealstage === stage.id);
    const isOpen = !stage.closedWon && !stage.closedLost;
    let amount = 0, atRiskCount = 0, atRiskAmount = 0;
    let stagnantCount = 0, stagnantAmount = 0, noNextActivityCount = 0;
    let totalDays = 0, daysCount = 0;

    for (const d of dealsInStage) {
      amount += d.amount;
      if (d.createdate) {
        const created = new Date(d.createdate).getTime();
        if (!isNaN(created)) {
          totalDays += (now - created) / (24 * 60 * 60 * 1000);
          daysCount++;
        }
      }
      if (isOpen) {
        if (d.probability < 0.3) { atRiskCount++; atRiskAmount += d.amount; }
        const lastContact = d.notes_last_contacted ? new Date(d.notes_last_contacted).getTime() : null;
        const noNext = !d.notes_next_activity_date;
        if (noNext) noNextActivityCount++;
        const stale = lastContact === null || lastContact < now - SEVEN_DAYS_MS;
        if (noNext && stale) { stagnantCount++; stagnantAmount += d.amount; }
      }
    }

    const count = dealsInStage.length;
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      probability: stage.probability,
      closedWon: stage.closedWon,
      closedLost: stage.closedLost,
      category: categorizeStage(stage),
      count,
      amount,
      weightedAmount: amount * (stage.probability / 100),
      avgAmount: count > 0 ? Math.round(amount / count) : 0,
      atRiskCount,
      atRiskAmount,
      stagnantCount,
      stagnantAmount,
      noNextActivityCount,
      avgDaysInStage: daysCount > 0 ? Math.round(totalDays / daysCount) : 0,
    };
  });

  const totalDeals = dealsInSelection.length;
  const totalAmount = dealsInSelection.reduce((s, d) => s + d.amount, 0);
  const totalWeightedAmount = byStage.reduce((s, sm) => s + sm.weightedAmount, 0);

  const openIds = new Set(selectedStages.filter((s) => !s.closedWon && !s.closedLost).map((s) => s.id));
  const wonIds = new Set(selectedStages.filter((s) => s.closedWon).map((s) => s.id));
  const lostIds = new Set(selectedStages.filter((s) => s.closedLost).map((s) => s.id));

  const openList = dealsInSelection.filter((d) => openIds.has(d.dealstage));
  const wonList = dealsInSelection.filter((d) => wonIds.has(d.dealstage));
  const lostList = dealsInSelection.filter((d) => lostIds.has(d.dealstage));

  const closedTotal = wonList.length + lostList.length;
  const closingRate = closedTotal > 0 ? Math.round((wonList.length / closedTotal) * 100) : 0;

  const atRiskCount = byStage.reduce((s, sm) => s + sm.atRiskCount, 0);
  const atRiskAmount = byStage.reduce((s, sm) => s + sm.atRiskAmount, 0);
  const stagnantCount = byStage.reduce((s, sm) => s + sm.stagnantCount, 0);
  const stagnantAmount = byStage.reduce((s, sm) => s + sm.stagnantAmount, 0);
  const noNextActivityCount = byStage.reduce((s, sm) => s + sm.noNextActivityCount, 0);

  const next30 = now + THIRTY_DAYS_MS, next90 = now + NINETY_DAYS_MS;
  const forecastNext30Days = openList.filter((d) => d.closedate && new Date(d.closedate).getTime() <= next30).reduce((s, d) => s + d.amount * d.probability, 0);
  const forecastNext90Days = openList.filter((d) => d.closedate && new Date(d.closedate).getTime() <= next90).reduce((s, d) => s + d.amount * d.probability, 0);
  const forecastNextQuarterAmount = openList.filter((d) => d.closedate && new Date(d.closedate).getTime() <= next90).reduce((s, d) => s + d.amount, 0);

  const closedWithDates = [...wonList, ...lostList].filter((d) => d.createdate && d.closedate);
  let totalCycle = 0;
  for (const d of closedWithDates) {
    const c = new Date(d.createdate!).getTime();
    const cl = new Date(d.closedate!).getTime();
    if (!isNaN(c) && !isNaN(cl) && cl > c) totalCycle += (cl - c) / (24 * 60 * 60 * 1000);
  }
  const avgCycleDays = closedWithDates.length > 0 ? Math.round(totalCycle / closedWithDates.length) : 0;

  return {
    pipeline,
    pipelineType: inferPipelineType(pipeline.label),
    selectedStages,
    isAllStagesSelected,
    selectionType: determineSelectionType(selectedStages, pipeline.stages.length),
    totalDeals,
    totalAmount,
    totalWeightedAmount,
    avgDealAmount: totalDeals > 0 ? Math.round(totalAmount / totalDeals) : 0,
    openDeals: openList.length,
    openAmount: openList.reduce((s, d) => s + d.amount, 0),
    wonDeals: wonList.length,
    wonAmount: wonList.reduce((s, d) => s + d.amount, 0),
    lostDeals: lostList.length,
    lostAmount: lostList.reduce((s, d) => s + d.amount, 0),
    closingRate,
    atRiskCount,
    atRiskAmount,
    stagnantCount,
    stagnantAmount,
    noNextActivityCount,
    forecastNext30Days,
    forecastNext90Days,
    forecastNextQuarterAmount,
    avgCycleDays,
    byStage,
  };
}

// ════════════════════════════════════════════════════════════════════
// FACTORIES — chaque ID est UNIQUE, le match() décide si elle s'applique
// ════════════════════════════════════════════════════════════════════

const FACTORIES: SimFactory[] = [
  // ═══════════════════════════════════════════════════════════
  // VELOCITY
  // ═══════════════════════════════════════════════════════════

  {
    id: "vel.cycle.global",
    section: "velocity",
    match: (c) => c.avgCycleDays >= 30,
    build: (c) => {
      const target = Math.max(20, Math.round(c.avgCycleDays * 0.8));
      return {
        title: `Cycle global : ${c.avgCycleDays}j → ${target}j en 90 jours`,
        description: `${stageScope(c)}. Réduction 20% du cycle = +20% deals fermés à équipe constante. Leviers : raccourcir chaque stage + e-sign + templates quote.`,
        impact: `~+${Math.round(c.wonDeals * 0.2)} deals gagnés / quarter`,
        category: "sales", color: "from-blue-500 to-cyan-600",
        forecastType: `vel_cycle_${c.pipeline.id}`, threshold: target, direction: "below",
      };
    },
  },
  {
    id: "vel.weighted_forecast",
    section: "velocity",
    match: (c) => c.openDeals >= 3,
    build: (c) => ({
      title: `Forecast pondéré : ${fmtK(c.totalWeightedAmount)} → ${fmtK(c.totalWeightedAmount * 1.2)} en 60 jours`,
      description: `${stageScope(c)}. ${c.openDeals} deals ouverts pour ${fmtK(c.openAmount)} brut. +20% via accélération deals stages avancés.`,
      impact: `+${fmtK(c.totalWeightedAmount * 0.2)} de forecast pondéré`,
      category: "sales", color: "from-indigo-500 to-purple-600",
      forecastType: `vel_weighted_${c.pipeline.id}`, threshold: Math.round(c.totalWeightedAmount * 1.2), direction: "above",
    }),
  },
  {
    id: "vel.no_next_activity",
    section: "velocity",
    match: (c) => c.noNextActivityCount > 0,
    build: (c) => ({
      title: `Suivi pipeline : ${c.noNextActivityCount} deals sans next activity → 0 en 14 jours`,
      description: `${stageScope(c)}. ${c.noNextActivityCount} deals ouverts sans next_activity_date. Workflow bloquant la sauvegarde sans next activity = effet immédiat.`,
      impact: `+${Math.round(c.noNextActivityCount * 0.7)} deals remis en suivi actif`,
      category: "sales", color: "from-cyan-500 to-blue-600",
      forecastType: `vel_no_next_${c.pipeline.id}`, threshold: 0, direction: "below",
    }),
  },
  {
    id: "vel.slowest_stage",
    section: "velocity",
    match: (c) => c.byStage.some((s) => !s.closedWon && !s.closedLost && s.count > 0 && s.avgDaysInStage > 14),
    build: (c) => {
      const slow = [...c.byStage].filter((s) => !s.closedWon && !s.closedLost && s.count > 0 && s.avgDaysInStage > 14)
        .sort((a, b) => b.avgDaysInStage - a.avgDaysInStage)[0];
      const target = Math.max(7, Math.round(slow.avgDaysInStage * 0.6));
      return {
        title: `Stage « ${slow.stageLabel} » : ${slow.avgDaysInStage}j moyenne → ${target}j en 60 jours`,
        description: `Étape la plus lente du pipeline (${slow.count} deals). Audit blocages : qualification, démo, négo. SLA dédié + escalade manager au-delà de ${target}j.`,
        impact: `Cycle global -${Math.round((slow.avgDaysInStage - target) / 7)}j`,
        category: "sales", color: "from-blue-500 to-indigo-600",
        forecastType: `vel_slow_${slow.stageId}`, threshold: target, direction: "below",
      };
    },
  },
  {
    id: "vel.coverage_3x",
    section: "velocity",
    match: (c) => c.openDeals > 0 && c.openDeals < 30,
    build: (c) => ({
      title: `Pipeline coverage : ${c.openDeals} → ${Math.max(30, c.openDeals * 3)} deals ouverts en 60 jours`,
      description: `${stageScope(c)}. Règle CRO : pipeline = 3x objectif quarter. Mobilisation SDR + inbound.`,
      impact: `+${Math.max(30, c.openDeals * 3) - c.openDeals} deals ouverts, couverture forecast atteinte`,
      category: "sales", color: "from-fuchsia-500 to-purple-600",
      forecastType: `vel_coverage_${c.pipeline.id}`, threshold: Math.max(30, c.openDeals * 3), direction: "above",
    }),
  },
  {
    id: "vel.review_ritual",
    section: "velocity",
    match: () => true,
    build: (c) => ({
      title: `Rituel pipeline review hebdo : 100% adoption en 14 jours`,
      description: `${stageScope(c)}. 30min/semaine avec sales lead : top 5 deals chauds, deals à relancer, deals à clôturer. Réduit la stagnation de 50%.`,
      impact: "Pipeline assaini chaque semaine, forecast plus fiable",
      category: "sales", color: "from-indigo-500 to-blue-600",
      forecastType: `vel_ritual_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },

  // VELOCITY — par PipelineType
  {
    id: "vel.new_business.discovery_to_demo",
    section: "velocity",
    match: (c) => c.pipelineType === "new_business" && c.byStage.some((s) => s.category === "early" && s.count > 0),
    build: (c) => {
      const earlyStages = c.byStage.filter((s) => s.category === "early");
      const totalEarly = earlyStages.reduce((s, st) => s + st.count, 0);
      return {
        title: `Stages early (${earlyStages.map(s => s.stageLabel).join(", ")}) : ${totalEarly} deals → démo sous 7 jours`,
        description: `Pipeline New Business. ${totalEarly} deals en stages d'amorçage. SLA contact discovery → démo bookée < 7j (vs 14j moyenne sans process).`,
        impact: `Cycle de vente raccourci de ~14j sur ${totalEarly} deals`,
        category: "sales", color: "from-blue-500 to-cyan-600",
        forecastType: `vel_nb_disco_demo_${c.pipeline.id}`, threshold: 7, direction: "below",
      };
    },
  },
  {
    id: "vel.renewal.j90_engagement",
    section: "velocity",
    match: (c) => c.pipelineType === "renewal",
    build: (c) => ({
      title: `Renewal J-90 : 100% comptes engagés ${fmtK(c.openAmount)} en 30 jours`,
      description: `Pipeline Renewal. Workflow obligatoire : touch CSM 90j avant échéance + RDV business review J-60 + signature J-30. Sans process = -10pts retention.`,
      impact: `Retention ${c.openDeals} renouvellements sécurisée`,
      category: "csm", color: "from-emerald-500 to-cyan-600",
      forecastType: `vel_renew_j90_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },
  {
    id: "vel.upsell.expansion_meeting",
    section: "velocity",
    match: (c) => c.pipelineType === "upsell",
    build: (c) => ({
      title: `Upsell cadence : 1 expansion meeting / customer / quarter en 60j`,
      description: `Pipeline Upsell/Expansion. Rituel obligatoire : QBR business review qui surface les opportunités d'expansion (usage, nouveaux besoins, équipe additionnelle).`,
      impact: `Pipeline upsell alimenté en continu sur la base ${c.openDeals} comptes actifs`,
      category: "csm", color: "from-fuchsia-500 to-emerald-600",
      forecastType: `vel_upsell_qbr_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },

  // VELOCITY — par SelectionType
  {
    id: "vel.single_late.closing_acceleration",
    section: "velocity",
    match: (c) => c.selectionType === "single_late",
    build: (c) => {
      const stage = c.selectedStages[0];
      return {
        title: `Closing acceleration « ${stage.label} » : signature en < 14j en 30 jours`,
        description: `Stage late (probabilité ${stage.probability}%). Process closing : e-sign obligatoire, urgence prix sur quote (validité 14j), escalade décideur si stagne 7j+.`,
        impact: `Cycle final divisé par 2 sur ${c.openDeals} deals chauds`,
        category: "sales", color: "from-purple-500 to-blue-600",
        forecastType: `vel_late_close_${stage.id}`, threshold: 14, direction: "below",
      };
    },
  },
  {
    id: "vel.single_mid.value_sell",
    section: "velocity",
    match: (c) => c.selectionType === "single_mid",
    build: (c) => {
      const stage = c.selectedStages[0];
      const stageMetrics = c.byStage.find((s) => s.stageId === stage.id);
      const count = stageMetrics?.count ?? 0;
      return {
        title: `Value selling « ${stage.label} » : démo personnalisée 100% en 14j`,
        description: `Stage mid (probabilité ${stage.probability}%). Standardiser la démo basée sur les 3 pain points découverts en Discovery. Démo générique = perte 40% taux conversion.`,
        impact: `+${Math.round(count * 0.2)} deals avancés au stage suivant`,
        category: "sales", color: "from-blue-500 to-purple-600",
        forecastType: `vel_mid_value_${stage.id}`, threshold: 100, direction: "above",
      };
    },
  },
  {
    id: "vel.single_early.qualification",
    section: "velocity",
    match: (c) => c.selectionType === "single_early",
    build: (c) => {
      const stage = c.selectedStages[0];
      return {
        title: `Qualification stricte « ${stage.label} » : MEDDIC 100% en 21 jours`,
        description: `Stage early (probabilité ${stage.probability}%). Passage en stage suivant uniquement si MEDDIC complet (Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion).`,
        impact: `Disqualification 30% deals non-mûrs = closing rate +15pts`,
        category: "sales", color: "from-cyan-500 to-blue-600",
        forecastType: `vel_early_meddic_${stage.id}`, threshold: 100, direction: "above",
      };
    },
  },
  {
    id: "vel.multi_open.transition_audit",
    section: "velocity",
    match: (c) => c.selectionType === "multi_open" && c.selectedStages.length >= 2,
    build: (c) => ({
      title: `Audit transitions stages : conversion ${c.selectedStages.length} étapes en 30 jours`,
      description: `${c.selectedStages.length} stages ouverts sélectionnés (${c.selectedStages.map(s => s.label).join(" → ")}). Mesurer le taux de passage stage-à-stage. Identifier le pire pour coaching ciblé.`,
      impact: `Goulet d'étranglement identifié + débloqué`,
      category: "sales", color: "from-blue-500 to-fuchsia-600",
      forecastType: `vel_multi_audit_${c.pipeline.id}`, threshold: 0, direction: "above",
    }),
  },

  // ═══════════════════════════════════════════════════════════
  // RISK
  // ═══════════════════════════════════════════════════════════

  {
    id: "risk.at_risk_global",
    section: "risk",
    match: (c) => c.atRiskCount > 0,
    build: (c) => ({
      title: `Deals à risque : ${c.atRiskCount} (${fmtK(c.atRiskAmount)}) → ${Math.max(0, Math.round(c.atRiskCount / 2))} en 30 jours`,
      description: `${stageScope(c)}. ${c.atRiskCount} deals avec probabilité <30%. Plan d'action obligatoire sous 48h pour chacun.`,
      impact: `Pipeline assaini, ${fmtK(c.atRiskAmount * 0.3)} d'amount sécurisé`,
      category: "sales", color: "from-rose-500 to-pink-600",
      forecastType: `risk_at_risk_${c.pipeline.id}`, threshold: Math.max(0, Math.round(c.atRiskCount / 2)), direction: "below",
    }),
  },
  {
    id: "risk.stagnation",
    section: "risk",
    match: (c) => c.stagnantCount > 0,
    build: (c) => ({
      title: `Stagnation : ${c.stagnantCount} deals figés (${fmtK(c.stagnantAmount)}) → 0 en 14 jours`,
      description: `${stageScope(c)}. War room hebdo : 1 décision/deal en 5min (relance OU lost).`,
      impact: `~+${Math.max(1, Math.round(c.stagnantCount * 0.3))} deals récupérés`,
      category: "sales", color: "from-rose-500 to-orange-600",
      forecastType: `risk_stagnant_${c.pipeline.id}`, threshold: 0, direction: "below",
    }),
  },
  {
    id: "risk.riskiest_stage",
    section: "risk",
    match: (c) => c.byStage.some((s) => !s.closedWon && !s.closedLost && s.atRiskAmount > 0),
    build: (c) => {
      const stage = [...c.byStage].filter((s) => !s.closedWon && !s.closedLost && s.atRiskCount > 0)
        .sort((a, b) => b.atRiskAmount - a.atRiskAmount)[0];
      return {
        title: `Stage « ${stage.stageLabel} » : ${stage.atRiskCount} deals à risque (${fmtK(stage.atRiskAmount)}) → -50% en 30 jours`,
        description: `Concentration de risque sur cette étape. Audit causes profondes : qualification mauvaise en amont, blocage négo, no decision. Sprint focalisé.`,
        impact: `${fmtK(stage.atRiskAmount / 2)} d'amount sauvé`,
        category: "sales", color: "from-rose-500 to-orange-600",
        forecastType: `risk_stage_${stage.stageId}`, threshold: Math.max(0, Math.round(stage.atRiskCount / 2)), direction: "below",
      };
    },
  },
  {
    id: "risk.tier1_escalation",
    section: "risk",
    match: (c) => c.avgDealAmount >= 5000 && c.openDeals >= 3,
    build: (c) => {
      const tier1 = c.avgDealAmount * 5;
      return {
        title: `Escalade Tier 1 (>${fmtK(tier1)}) : 100% deals stagnants 7j+ en 14 jours`,
        description: `${stageScope(c)}. Workflow auto qui notifie le manager si deal Tier 1 stagne 7j+ sans next_activity. Action requise sous 48h.`,
        impact: "0 deal Tier 1 perdu par négligence",
        category: "sales", color: "from-rose-500 to-purple-600",
        forecastType: `risk_tier1_${c.pipeline.id}`, threshold: 100, direction: "above",
      };
    },
  },
  {
    id: "risk.ghost_deals",
    section: "risk",
    match: (c) => c.openDeals >= 5,
    build: (c) => ({
      title: `Ghost deals : 0 deals avec closedate dépassée en 14 jours`,
      description: `${stageScope(c)}. Deals avec closedate dans le passé sans clôture = pipeline mort. Décision binaire : réplanifier sérieusement OU lost.`,
      impact: "Forecast nettoyé, pipeline réaliste",
      category: "sales", color: "from-orange-500 to-rose-600",
      forecastType: `risk_ghost_${c.pipeline.id}`, threshold: 0, direction: "below",
    }),
  },

  // RISK — par PipelineType
  {
    id: "risk.renewal.alert_j90",
    section: "risk",
    match: (c) => c.pipelineType === "renewal",
    build: (c) => ({
      title: `Renewal alerte J-90 : 100% renouvellements ${fmtK(c.openAmount)} sécurisés en 14 jours`,
      description: `Pipeline Renewal. Workflow d'alerte CSM 90j avant échéance contractuelle. Sans alerte = -10pts retention sur les comptes négligés.`,
      impact: `${c.openDeals} comptes en risque renouvellement traités proactivement`,
      category: "csm", color: "from-rose-500 to-fuchsia-600",
      forecastType: `risk_renew_j90_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },
  {
    id: "risk.upsell.dormant_account",
    section: "risk",
    match: (c) => c.pipelineType === "upsell",
    build: (c) => ({
      title: `Comptes dormants upsell : 0 sans contact > 60j en 14 jours`,
      description: `Pipeline Upsell. Comptes upsell sans engagement CSM > 60j = signal expansion ratée + risque churn caché. Workflow réactivation.`,
      impact: "Détection précoce risque + opportunités expansion",
      category: "csm", color: "from-rose-500 to-amber-600",
      forecastType: `risk_upsell_dormant_${c.pipeline.id}`, threshold: 0, direction: "below",
    }),
  },
  {
    id: "risk.new_business.lost_reasons_audit",
    section: "risk",
    match: (c) => c.pipelineType === "new_business" && c.lostDeals >= 5,
    build: (c) => ({
      title: `Audit lost reasons : 100% deals perdus catégorisés en 30 jours`,
      description: `Pipeline New Business. ${c.lostDeals} deals perdus. Sans lost_reason structuré, aucun apprentissage. Catégoriser : prix, concurrent, no decision, timing, mauvais ICP.`,
      impact: "Identification du top lost_reason → action correctrice",
      category: "sales", color: "from-rose-500 to-orange-600",
      forecastType: `risk_nb_lost_audit_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },

  // RISK — par SelectionType
  {
    id: "risk.single_early.disqualify_30",
    section: "risk",
    match: (c) => c.selectionType === "single_early",
    build: (c) => {
      const stage = c.selectedStages[0];
      const stageMetrics = c.byStage.find((s) => s.stageId === stage.id);
      const count = stageMetrics?.count ?? 0;
      return {
        title: `Disqualification stricte « ${stage.label} » : -30% deals en 30 jours`,
        description: `Stage early. ${count} deals au stage ${stage.label}. Disqualifier 30% via critères ICP non rencontrés = closing rate +15pts mécanique.`,
        impact: `Pipeline assaini, énergie sales focalisée`,
        category: "sales", color: "from-rose-500 to-orange-600",
        forecastType: `risk_early_disqual_${stage.id}`, threshold: Math.max(0, Math.round(count * 0.7)), direction: "below",
      };
    },
  },
  {
    id: "risk.single_late.no_proposal",
    section: "risk",
    match: (c) => c.selectionType === "single_late" && c.selectedStages[0]?.label.toLowerCase().includes("propos"),
    build: (c) => {
      const stage = c.selectedStages[0];
      return {
        title: `Stage « ${stage.label} » sans devis envoyé : 0 en 7 jours`,
        description: `Tous les deals au stage Proposition doivent avoir un devis HubSpot émis. Audit immédiat des deals sans quote → générer ou rétrograder.`,
        impact: `Cycle quote-to-close mesurable + accéléré`,
        category: "sales", color: "from-rose-500 to-amber-600",
        forecastType: `risk_late_noprop_${stage.id}`, threshold: 0, direction: "below",
      };
    },
  },
  {
    id: "risk.multi_with_closed.lost_pattern",
    section: "risk",
    match: (c) => c.selectionType === "multi_with_closed" && c.lostDeals >= 5,
    build: (c) => ({
      title: `Pattern lost : analyser ${c.lostDeals} deals perdus sur sélection en 30j`,
      description: `Sélection inclut un stage closed_lost. Analyse : à quel stage les deals perdus stagnaient ? Quelle proba moyenne ? Quel lost_reason dominant ? Coaching ciblé.`,
      impact: `Réduction lost rate de 5-10pts via apprentissage data-driven`,
      category: "sales", color: "from-rose-500 to-purple-600",
      forecastType: `risk_lost_pattern_${c.pipeline.id}`, threshold: 0, direction: "above",
    }),
  },

  // ═══════════════════════════════════════════════════════════
  // FORECAST CA
  // ═══════════════════════════════════════════════════════════

  {
    id: "forecast.30d",
    section: "forecast",
    match: (c) => c.forecastNext30Days > 0,
    build: (c) => ({
      title: `Forecast 30j : ${fmtK(c.forecastNext30Days)} → +20% en 30 jours`,
      description: `${stageScope(c)}. Forecast pondéré sur deals avec closedate ≤30j. Levier : accélération deals stages avancés + relances ciblées.`,
      impact: `+${fmtK(c.forecastNext30Days * 0.2)} sur le mois`,
      category: "sales", color: "from-emerald-500 to-teal-600",
      forecastType: `fcst_30d_${c.pipeline.id}`, threshold: Math.round(c.forecastNext30Days * 1.2), direction: "above",
    }),
  },
  {
    id: "forecast.90d",
    section: "forecast",
    match: (c) => c.forecastNext90Days > 0,
    build: (c) => ({
      title: `Forecast quarter : ${fmtK(c.forecastNext90Days)} → ${fmtK(c.forecastNext90Days * 1.15)} en 90 jours`,
      description: `${stageScope(c)}. Forecast pondéré sur deals avec closedate ≤90j. +15% via combinaison closing rate + accélération + nouveaux deals créés.`,
      impact: `+${fmtK(c.forecastNext90Days * 0.15)} ce quarter`,
      category: "sales", color: "from-emerald-500 to-cyan-600",
      forecastType: `fcst_90d_${c.pipeline.id}`, threshold: Math.round(c.forecastNext90Days * 1.15), direction: "above",
    }),
  },
  {
    id: "forecast.accuracy",
    section: "forecast",
    match: () => true,
    build: (c) => ({
      title: `Forecast accuracy : 90%+ en 60 jours`,
      description: `${stageScope(c)}. Audit hebdo écart forecast vs réalisé par stage. Discipline sales : pas de forecast sans next_activity + amount + closedate.`,
      impact: "Direction commerciale alignée + planification fiabilisée",
      category: "sales", color: "from-cyan-500 to-emerald-600",
      forecastType: `fcst_accuracy_${c.pipeline.id}`, threshold: 90, direction: "above",
    }),
  },
  {
    id: "forecast.hot_stages",
    section: "forecast",
    match: (c) => c.byStage.some((s) => !s.closedWon && !s.closedLost && s.probability >= 50 && s.amount > 0),
    build: (c) => {
      const hot = [...c.byStage]
        .filter((s) => !s.closedWon && !s.closedLost && s.probability >= 50 && s.amount > 0)
        .sort((a, b) => b.weightedAmount - a.weightedAmount)[0];
      return {
        title: `Stage hot « ${hot.stageLabel} » : ${fmtK(hot.weightedAmount)} pondéré → +30% en 60 jours`,
        description: `Étape à fort potentiel (${hot.count} deals × ${hot.probability}% probability). Sprint accélération : revue 1-by-1 avec sales lead, déblocage objections.`,
        impact: `+${fmtK(hot.weightedAmount * 0.3)} de forecast pondéré`,
        category: "sales", color: "from-emerald-500 to-blue-600",
        forecastType: `fcst_hot_${hot.stageId}`, threshold: Math.round(hot.weightedAmount * 1.3), direction: "above",
      };
    },
  },
  {
    id: "forecast.pipeline_3x",
    section: "forecast",
    match: (c) => c.openAmount > 0,
    build: (c) => {
      const target = Math.max(c.openAmount * 1.5, 100000);
      return {
        title: `Pipeline value : ${fmtK(c.openAmount)} → ${fmtK(target)} en 60 jours (3x quarter)`,
        description: `${stageScope(c)}. Règle CRO : pipeline ouvert = 3x objectif revenue trimestre. Mobilisation acquisition (SDR + inbound + ABM).`,
        impact: "Couverture forecast atteinte, marge d'erreur acceptable",
        category: "sales", color: "from-emerald-500 to-blue-600",
        forecastType: `fcst_3x_${c.pipeline.id}`, threshold: target, direction: "above",
      };
    },
  },
  {
    id: "forecast.closedate_discipline",
    section: "forecast",
    match: () => true,
    build: (c) => ({
      title: `Closedate discipline : 100% deals open avec closedate < 90j en 30 jours`,
      description: `${stageScope(c)}. Champ closedate obligatoire dès stage Qualification. Workflow alerte si closedate vide ou >180j sur deal actif.`,
      impact: "Forecast par mois/quarter possible et fiable",
      category: "sales", color: "from-cyan-500 to-blue-600",
      forecastType: `fcst_closedate_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },
  {
    id: "forecast.closing_rate",
    section: "forecast",
    match: (c) => c.wonDeals + c.lostDeals >= 5,
    build: (c) => {
      const target = Math.min(50, Math.max(c.closingRate + 10, 30));
      return {
        title: `Closing rate forecast : ${c.closingRate}% → ${target}% en 90 jours`,
        description: `${stageScope(c)}. ${c.wonDeals} deals gagnés / ${c.wonDeals + c.lostDeals} clôturés. Action : MEDDIC en stage Qualification + disqualifier 30% à la Discovery.`,
        impact: `~+${Math.max(1, Math.round((c.wonDeals + c.lostDeals) * (target - c.closingRate) / 100))} deals gagnés / quarter`,
        category: "sales", color: "from-emerald-500 to-teal-600",
        forecastType: `fcst_close_rate_${c.pipeline.id}`, threshold: target, direction: "above",
      };
    },
  },

  // FORECAST — par PipelineType
  {
    id: "forecast.renewal.retention_rate",
    section: "forecast",
    match: (c) => c.pipelineType === "renewal",
    build: (c) => ({
      title: `Retention rate prévue : ${c.closingRate}% → 95%+ en 90 jours`,
      description: `Pipeline Renewal. Top quartile B2B SaaS : 95%+. Workflow alerte CSM J-90 + plan d'engagement = +5pts retention immédiats.`,
      impact: `${fmtK(c.openAmount)} de revenue récurrent sécurisé`,
      category: "csm", color: "from-emerald-500 to-fuchsia-600",
      forecastType: `fcst_renew_retention_${c.pipeline.id}`, threshold: 95, direction: "above",
    }),
  },
  {
    id: "forecast.upsell.expansion_revenue",
    section: "forecast",
    match: (c) => c.pipelineType === "upsell",
    build: (c) => ({
      title: `Expansion MRR : +10% en 90 jours via upsell`,
      description: `Pipeline Upsell détecté. Détection auto comptes prêts (usage croissant + NPS promoteur). Workflow d'alerte CSM expansion.`,
      impact: "+10% MRR sans coût d'acquisition (CAC payback immédiat)",
      category: "csm", color: "from-emerald-500 to-fuchsia-600",
      forecastType: `fcst_upsell_mrr_${c.pipeline.id}`, threshold: 10, direction: "above",
    }),
  },
  {
    id: "forecast.new_business.run_rate",
    section: "forecast",
    match: (c) => c.pipelineType === "new_business" && c.wonDeals > 0,
    build: (c) => ({
      title: `Run rate New Business : ${fmtK(c.wonAmount)} cumulés → +25% sur prochain quarter`,
      description: `Pipeline New Business. ${c.wonDeals} deals gagnés. Cible top quartile : +25% du run rate via combo win rate + ticket moyen + volume deals créés.`,
      impact: `+${fmtK(c.wonAmount * 0.25)} de revenue acquisition`,
      category: "sales", color: "from-emerald-500 to-blue-600",
      forecastType: `fcst_nb_runrate_${c.pipeline.id}`, threshold: Math.round(c.wonAmount * 1.25), direction: "above",
    }),
  },

  // FORECAST — par SelectionType
  {
    id: "forecast.single_late.signature_acceleration",
    section: "forecast",
    match: (c) => c.selectionType === "single_late",
    build: (c) => {
      const stage = c.selectedStages[0];
      const stageMetrics = c.byStage.find((s) => s.stageId === stage.id);
      const weighted = stageMetrics?.weightedAmount ?? 0;
      const target = Math.round(weighted * 1.4);
      return {
        title: `Signature accélérée « ${stage.label} » : ${fmtK(weighted)} → ${fmtK(target)} en 30 jours`,
        description: `Stage late = potentiel quick wins (probabilité ${stage.probability}%). Templates quote + e-sign + relance auto J+3/J+7 → +40% conversion.`,
        impact: `+${fmtK(target - weighted)} sur le mois`,
        category: "sales", color: "from-emerald-500 to-purple-600",
        forecastType: `fcst_late_sign_${stage.id}`, threshold: target, direction: "above",
      };
    },
  },

  // ═══════════════════════════════════════════════════════════
  // CA ANALYTICS
  // ═══════════════════════════════════════════════════════════

  {
    id: "analytics.won_amount",
    section: "analytics",
    match: (c) => c.wonDeals > 0,
    build: (c) => ({
      title: `CA gagné : ${fmtK(c.wonAmount)} cumulés → +20% en 90 jours`,
      description: `${stageScope(c)}. ${c.wonDeals} deals gagnés. Cible : +20% du run rate via combo closing rate + ticket moyen + volume deals.`,
      impact: `+${fmtK(c.wonAmount * 0.2)} cumulés`,
      category: "sales", color: "from-emerald-500 to-cyan-600",
      forecastType: `ana_won_${c.pipeline.id}`, threshold: Math.round(c.wonAmount * 1.2), direction: "above",
    }),
  },
  {
    id: "analytics.avg_ticket",
    section: "analytics",
    match: (c) => c.wonDeals >= 3,
    build: (c) => {
      const avg = Math.round(c.wonAmount / c.wonDeals);
      const target = Math.round(avg * 1.15);
      return {
        title: `Ticket moyen : ${fmtK(avg)} → ${fmtK(target)} en 90 jours (+15%)`,
        description: `${stageScope(c)}. Pricing tiers + bundling + démo features avancées en Discovery. Cibler upsell sur les deals fermables.`,
        impact: `+${fmtK(target - avg)}/deal × ${c.wonDeals} deals`,
        category: "sales", color: "from-emerald-500 to-blue-600",
        forecastType: `ana_avg_ticket_${c.pipeline.id}`, threshold: target, direction: "above",
      };
    },
  },
  {
    id: "analytics.dropoff_stage",
    section: "analytics",
    match: (c) => c.byStage.some((s) => !s.closedWon && !s.closedLost && s.probability < 50 && s.count > 5),
    build: (c) => {
      const dropoff = [...c.byStage]
        .filter((s) => !s.closedWon && !s.closedLost && s.probability < 50 && s.count > 5)
        .sort((a, b) => b.count - a.count)[0];
      return {
        title: `Drop-off « ${dropoff.stageLabel} » : ${dropoff.count} deals bloqués → -30% en 60 jours`,
        description: `${dropoff.count} deals bloqués au stage avec probabilité ${dropoff.probability}%. Coaching ciblé sur cette transition + role-plays + script optimisé.`,
        impact: `+${Math.round(dropoff.count * 0.3)} deals avancés au stage suivant`,
        category: "sales", color: "from-amber-500 to-emerald-600",
        forecastType: `ana_dropoff_${dropoff.stageId}`, threshold: Math.max(0, Math.round(dropoff.count * 0.7)), direction: "below",
      };
    },
  },
  {
    id: "analytics.stage_conversion_audit",
    section: "analytics",
    match: (c) => c.byStage.filter((s) => !s.closedWon && !s.closedLost && s.count > 0).length >= 2,
    build: (c) => {
      const openStagesCount = c.byStage.filter((s) => !s.closedWon && !s.closedLost && s.count > 0).length;
      return {
        title: `Conversion stage-to-stage : audit complet en 30 jours`,
        description: `${stageScope(c)}. Construire un rapport HubSpot stage-to-stage conversion sur les ${openStagesCount} stages actifs. Identifier la pire transition pour coaching ciblé.`,
        impact: "Coaching data-driven sur le bon point de friction",
        category: "sales", color: "from-emerald-500 to-amber-600",
        forecastType: `ana_stage_conv_${c.pipeline.id}`, threshold: 0, direction: "above",
      };
    },
  },
  {
    id: "analytics.win_rate_segments",
    section: "analytics",
    match: (c) => c.wonDeals + c.lostDeals >= 10,
    build: (c) => {
      const target = Math.min(50, Math.max(c.closingRate + 10, 30));
      return {
        title: `Win rate par segment : ${c.closingRate}% → ${target}% en 90 jours`,
        description: `${stageScope(c)}. Analyser win rate par segment (taille, secteur, source) → identifier top 3 ICP → ré-allouer 80% du budget acquisition.`,
        impact: `~+${Math.max(1, Math.round((c.wonDeals + c.lostDeals) * (target - c.closingRate) / 100))} deals gagnés / quarter`,
        category: "sales", color: "from-emerald-500 to-teal-600",
        forecastType: `ana_winrate_${c.pipeline.id}`, threshold: target, direction: "above",
      };
    },
  },
  {
    id: "analytics.source_attribution",
    section: "analytics",
    match: () => true,
    build: (c) => ({
      title: `Attribution source : 100% deals avec hs_analytics_source en 30 jours`,
      description: `${stageScope(c)}. Workflow obligeant à renseigner la source à la création deal. Reporting mensuel revenue par canal (inbound, outbound, referral, partner).`,
      impact: "ROI marketing mesurable, ré-allocation budget facilitée",
      category: "sales", color: "from-emerald-500 to-fuchsia-600",
      forecastType: `ana_source_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },

  // ANALYTICS — par PipelineType
  {
    id: "analytics.new_business.cac_payback",
    section: "analytics",
    match: (c) => c.pipelineType === "new_business" && c.wonDeals > 0,
    build: (c) => {
      const avg = Math.round(c.wonAmount / c.wonDeals);
      return {
        title: `CAC Payback New Business : < 12 mois en 90 jours`,
        description: `Pipeline New Business. Ticket moyen ${fmtK(avg)}. Mesurer CAC (coût acquisition) vs revenue 12 premiers mois → ratio < 1 = sain.`,
        impact: "Modèle d'acquisition rentable et scalable",
        category: "sales", color: "from-emerald-500 to-blue-600",
        forecastType: `ana_nb_cac_${c.pipeline.id}`, threshold: 12, direction: "below",
      };
    },
  },
  {
    id: "analytics.renewal.nrr",
    section: "analytics",
    match: (c) => c.pipelineType === "renewal",
    build: (c) => ({
      title: `Net Revenue Retention : 100%+ en 12 mois`,
      description: `Pipeline Renewal. NRR = (MRR_début + expansion - churn - downgrade) / MRR_début. > 100% = croissance même sans new business.`,
      impact: "Modèle SaaS sain, valorisation x10 vs churn négatif",
      category: "csm", color: "from-teal-500 to-emerald-600",
      forecastType: `ana_renew_nrr_${c.pipeline.id}`, threshold: 100, direction: "above",
    }),
  },
  {
    id: "analytics.upsell.cross_sell",
    section: "analytics",
    match: (c) => c.pipelineType === "upsell",
    build: (c) => ({
      title: `Cross-sell : 1 produit additionnel par customer en 6 mois`,
      description: `Pipeline Upsell. Map produits par persona + déclencheurs upsell auto. Cible : 30% des customers avec 2+ produits actifs en 6 mois.`,
      impact: "Expansion revenue sans coût acquisition",
      category: "csm", color: "from-emerald-500 to-purple-600",
      forecastType: `ana_upsell_cross_${c.pipeline.id}`, threshold: 30, direction: "above",
    }),
  },

  // ANALYTICS — par SelectionType
  {
    id: "analytics.single_closed_won.cohort",
    section: "analytics",
    match: (c) => c.selectionType === "single_closed_won" && c.wonDeals >= 5,
    build: (c) => ({
      title: `LTV par cohort « ${c.selectedStages[0].label} » : analyse en 60 jours`,
      description: `Stage closed-won sélectionné. Calculer revenue généré par mois × cohort signature. Identifier les meilleures cohorts pour répliquer les conditions de signature.`,
      impact: "Modèle SaaS optimisé sur les conditions de meilleur LTV",
      category: "csm", color: "from-emerald-500 to-cyan-600",
      forecastType: `ana_won_cohort_${c.pipeline.id}`, threshold: 0, direction: "above",
    }),
  },
  {
    id: "analytics.single_closed_lost.lost_reasons",
    section: "analytics",
    match: (c) => c.selectionType === "single_closed_lost" && c.lostDeals >= 5,
    build: (c) => ({
      title: `Top lost_reasons « ${c.selectedStages[0].label} » : top 3 identifiés en 30 jours`,
      description: `Stage closed-lost sélectionné. ${c.lostDeals} deals perdus à analyser. Top 3 lost_reasons (prix, concurrent, no decision) → action correctrice par catégorie.`,
      impact: "Réduction lost rate de 5-10pts via apprentissage",
      category: "sales", color: "from-rose-500 to-amber-600",
      forecastType: `ana_lost_reasons_${c.pipeline.id}`, threshold: 0, direction: "above",
    }),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// RUNNER
// ────────────────────────────────────────────────────────────────────────────

export type CycleVentesSimulations = {
  velocity: SmartSimulation[];
  risk: SmartSimulation[];
  forecast: SmartSimulation[];
  analytics: SmartSimulation[];
  context: PipelineSelectionContext;
};

export function buildCycleVentesSimulations(
  pipeline: PipelineInfo,
  deals: DealLite[],
  selectedStageIds: string[],
): CycleVentesSimulations {
  const context = buildPipelineSelectionContext(pipeline, deals, selectedStageIds);

  const result: CycleVentesSimulations = {
    velocity: [],
    risk: [],
    forecast: [],
    analytics: [],
    context,
  };

  // Itère sur toutes les factories. Chacune est checkée par son match()
  // contre le contexte. Si match → build → push dans la section appropriée.
  // Aucun risque de doublon car chaque factory a un id unique.
  for (const factory of FACTORIES) {
    try {
      if (!factory.match(context)) continue;
      const built = factory.build(context);
      const sim: SmartSimulation = {
        id: factory.id,
        section: factory.section,
        simulationCategory: "cycle_ventes",
        pipelineId: context.pipeline.id,
        pipelineLabel: context.pipeline.label,
        selectedStageIds: context.selectedStages.map((s) => s.id),
        ...built,
      };
      result[factory.section].push(sim);
    } catch {
      // Une factory défaillante ne casse pas le runner
    }
  }

  return result;
}
