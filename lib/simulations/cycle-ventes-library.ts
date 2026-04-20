/**
 * Bibliothèque de simulations SMART pour le Cycle de Ventes — Phase 8.7
 *
 * Architecture :
 *   - PipelineSelectionContext : agrège les métriques calculées depuis les deals
 *     du pipeline sélectionné, restreint aux stages choisis.
 *   - 4 générateurs (velocity, risk, forecast, analytics) qui retournent des
 *     simulations SMART contextualisées au pipeline + stages.
 *
 * Chaque simulation est :
 *   - Specific : titre clair "[KPI current] → [target] [unit]"
 *   - Measurable : valeurs numériques extraites du contexte réel
 *   - Achievable : cibles top quartile B2B
 *   - Relevant : action concrète CRO/RevOps
 *   - Time-bound : timeframe explicite (14j/30j/60j/90j)
 *
 * Robustesse :
 *   - Toutes les valeurs sont défensives (NaN/null safe)
 *   - Si pas assez de signal, le générateur retourne moins de simulations
 *     plutôt que de produire des items absurdes (ex: pas d'objectif sur 0 deal)
 */

import type { PipelineInfo, PipelineStage } from "@/lib/integrations/hubspot-snapshot";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type DealLite = {
  id: string;
  amount: number;
  closedate: string | null; // ISO
  dealstage: string;
  probability: number; // 0..1
  notes_last_contacted: string | null;
  notes_next_activity_date: string | null;
  createdate: string | null;
  is_closed: boolean;
  is_won: boolean;
};

export type StageMetrics = {
  stageId: string;
  stageLabel: string;
  probability: number; // %
  closedWon: boolean;
  closedLost: boolean;

  count: number;
  amount: number;
  weightedAmount: number;
  avgAmount: number;

  // Risk signals (ne s'applique qu'aux stages OUVERTS)
  atRiskCount: number; // probability < 30%
  atRiskAmount: number;
  stagnantCount: number; // pas de next activity AND last_contacted > 7j
  stagnantAmount: number;
  noNextActivityCount: number;

  // Time signals
  avgDaysInStage: number; // approximation via createdate
};

export type PipelineSelectionContext = {
  pipeline: PipelineInfo;
  selectedStages: PipelineStage[];
  isAllStagesSelected: boolean;

  // Métriques agrégées sur les stages sélectionnés
  totalDeals: number;
  totalAmount: number;
  totalWeightedAmount: number;
  avgDealAmount: number;

  // Open vs closed (parmi sélection)
  openDeals: number;
  openAmount: number;
  wonDeals: number;
  wonAmount: number;
  lostDeals: number;
  lostAmount: number;
  closingRate: number; // 0..100

  // Risque (parmi open dans sélection)
  atRiskCount: number;
  atRiskAmount: number;
  stagnantCount: number;
  stagnantAmount: number;
  noNextActivityCount: number;

  // Forecast time-based
  forecastNext30Days: number;
  forecastNext90Days: number;
  forecastNextQuarterAmount: number;

  // Cycle de vente
  avgCycleDays: number; // estimé sur deals fermés (won OR lost)

  // Per-stage detail
  byStage: StageMetrics[];
};

export type SmartSimulation = {
  title: string;
  description: string;
  impact: string;
  category: "sales" | "csm" | "marketing" | "data";
  simulationCategory: "cycle_ventes";
  section: "velocity" | "risk" | "forecast" | "analytics";
  color: string; // gradient Tailwind
  forecastType: string;
  threshold: number;
  direction: "above" | "below";
  // Contexte d'identification (pour persister l'alerte avec ses filtres)
  pipelineId: string;
  pipelineLabel: string;
  selectedStageIds: string[];
};

// ────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER (pure function, déterministe à partir des deals + pipeline)
// ────────────────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function buildPipelineSelectionContext(
  pipeline: PipelineInfo,
  allDeals: DealLite[],
  selectedStageIds: string[],
): PipelineSelectionContext {
  // Si aucun stage sélectionné OU "all", on prend tous les stages du pipeline
  const isAllStagesSelected = selectedStageIds.length === 0;
  const selectedStages = isAllStagesSelected
    ? pipeline.stages
    : pipeline.stages.filter((s) => selectedStageIds.includes(s.id));
  const stageIdsSet = new Set(selectedStages.map((s) => s.id));

  // Filtre les deals dans la sélection
  const dealsInSelection = allDeals.filter((d) => stageIdsSet.has(d.dealstage));

  // Calcul per-stage
  const now = Date.now();
  const byStage: StageMetrics[] = selectedStages.map((stage) => {
    const dealsInStage = dealsInSelection.filter((d) => d.dealstage === stage.id);
    const isOpen = !stage.closedWon && !stage.closedLost;

    let amount = 0;
    let atRiskCount = 0;
    let atRiskAmount = 0;
    let stagnantCount = 0;
    let stagnantAmount = 0;
    let noNextActivityCount = 0;
    let totalDaysInStage = 0;
    let daysInStageCount = 0;

    for (const d of dealsInStage) {
      amount += d.amount;
      if (d.createdate) {
        const created = new Date(d.createdate).getTime();
        if (!isNaN(created)) {
          totalDaysInStage += (now - created) / (24 * 60 * 60 * 1000);
          daysInStageCount++;
        }
      }
      if (isOpen) {
        if (d.probability < 0.3) {
          atRiskCount++;
          atRiskAmount += d.amount;
        }
        const lastContact = d.notes_last_contacted ? new Date(d.notes_last_contacted).getTime() : null;
        const noNext = !d.notes_next_activity_date;
        if (noNext) noNextActivityCount++;
        const stale = lastContact === null || lastContact < now - SEVEN_DAYS_MS;
        if (noNext && stale) {
          stagnantCount++;
          stagnantAmount += d.amount;
        }
      }
    }

    const count = dealsInStage.length;
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      probability: stage.probability,
      closedWon: stage.closedWon,
      closedLost: stage.closedLost,
      count,
      amount,
      weightedAmount: amount * (stage.probability / 100),
      avgAmount: count > 0 ? Math.round(amount / count) : 0,
      atRiskCount,
      atRiskAmount,
      stagnantCount,
      stagnantAmount,
      noNextActivityCount,
      avgDaysInStage: daysInStageCount > 0 ? Math.round(totalDaysInStage / daysInStageCount) : 0,
    };
  });

  // Agrégations globales sur sélection
  const totalDeals = dealsInSelection.length;
  const totalAmount = dealsInSelection.reduce((s, d) => s + d.amount, 0);
  const totalWeightedAmount = byStage.reduce((s, sm) => s + sm.weightedAmount, 0);

  const openStagesIds = new Set(selectedStages.filter((s) => !s.closedWon && !s.closedLost).map((s) => s.id));
  const wonStagesIds = new Set(selectedStages.filter((s) => s.closedWon).map((s) => s.id));
  const lostStagesIds = new Set(selectedStages.filter((s) => s.closedLost).map((s) => s.id));

  const openDealsList = dealsInSelection.filter((d) => openStagesIds.has(d.dealstage));
  const wonDealsList = dealsInSelection.filter((d) => wonStagesIds.has(d.dealstage));
  const lostDealsList = dealsInSelection.filter((d) => lostStagesIds.has(d.dealstage));

  const openDeals = openDealsList.length;
  const openAmount = openDealsList.reduce((s, d) => s + d.amount, 0);
  const wonDeals = wonDealsList.length;
  const wonAmount = wonDealsList.reduce((s, d) => s + d.amount, 0);
  const lostDeals = lostDealsList.length;
  const lostAmount = lostDealsList.reduce((s, d) => s + d.amount, 0);
  const closedTotal = wonDeals + lostDeals;
  const closingRate = closedTotal > 0 ? Math.round((wonDeals / closedTotal) * 100) : 0;

  // Risque
  const atRiskCount = byStage.reduce((s, sm) => s + sm.atRiskCount, 0);
  const atRiskAmount = byStage.reduce((s, sm) => s + sm.atRiskAmount, 0);
  const stagnantCount = byStage.reduce((s, sm) => s + sm.stagnantCount, 0);
  const stagnantAmount = byStage.reduce((s, sm) => s + sm.stagnantAmount, 0);
  const noNextActivityCount = byStage.reduce((s, sm) => s + sm.noNextActivityCount, 0);

  // Forecast time-based
  const next30 = now + THIRTY_DAYS_MS;
  const next90 = now + NINETY_DAYS_MS;
  const forecastNext30Days = openDealsList
    .filter((d) => d.closedate && new Date(d.closedate).getTime() <= next30)
    .reduce((s, d) => s + d.amount * d.probability, 0);
  const forecastNext90Days = openDealsList
    .filter((d) => d.closedate && new Date(d.closedate).getTime() <= next90)
    .reduce((s, d) => s + d.amount * d.probability, 0);
  const forecastNextQuarterAmount = openDealsList
    .filter((d) => d.closedate && new Date(d.closedate).getTime() <= next90)
    .reduce((s, d) => s + d.amount, 0);

  // Cycle de vente moyen sur deals fermés
  const closedDealsWithDates = [...wonDealsList, ...lostDealsList].filter(
    (d) => d.createdate && d.closedate,
  );
  let totalCycleDays = 0;
  for (const d of closedDealsWithDates) {
    const created = new Date(d.createdate!).getTime();
    const closed = new Date(d.closedate!).getTime();
    if (!isNaN(created) && !isNaN(closed) && closed > created) {
      totalCycleDays += (closed - created) / (24 * 60 * 60 * 1000);
    }
  }
  const avgCycleDays = closedDealsWithDates.length > 0
    ? Math.round(totalCycleDays / closedDealsWithDates.length)
    : 0;

  return {
    pipeline,
    selectedStages,
    isAllStagesSelected,
    totalDeals,
    totalAmount,
    totalWeightedAmount,
    avgDealAmount: totalDeals > 0 ? Math.round(totalAmount / totalDeals) : 0,
    openDeals,
    openAmount,
    wonDeals,
    wonAmount,
    lostDeals,
    lostAmount,
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

// ────────────────────────────────────────────────────────────────────────────
// HELPERS pour SMART simulation factory
// ────────────────────────────────────────────────────────────────────────────

const fmtK = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M€`
    : n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

function makeBase(
  ctx: PipelineSelectionContext,
  section: SmartSimulation["section"],
): Pick<SmartSimulation, "simulationCategory" | "section" | "pipelineId" | "pipelineLabel" | "selectedStageIds"> {
  return {
    simulationCategory: "cycle_ventes",
    section,
    pipelineId: ctx.pipeline.id,
    pipelineLabel: ctx.pipeline.label,
    selectedStageIds: ctx.selectedStages.map((s) => s.id),
  };
}

function stageSubtitle(ctx: PipelineSelectionContext): string {
  if (ctx.isAllStagesSelected) return `Pipeline « ${ctx.pipeline.label} » — toutes étapes`;
  if (ctx.selectedStages.length === 1) return `Pipeline « ${ctx.pipeline.label} » — étape « ${ctx.selectedStages[0].label} »`;
  return `Pipeline « ${ctx.pipeline.label} » — ${ctx.selectedStages.length} étapes sélectionnées`;
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATOR : VÉLOCITÉ PIPELINE
// ────────────────────────────────────────────────────────────────────────────

export function generateVelocitySimulations(ctx: PipelineSelectionContext): SmartSimulation[] {
  const sims: SmartSimulation[] = [];
  const base = makeBase(ctx, "velocity");
  const subtitle = stageSubtitle(ctx);
  const targetCycle = ctx.avgCycleDays > 0 ? Math.max(20, Math.round(ctx.avgCycleDays * 0.8)) : 60;

  // 1. Cycle de vente moyen
  if (ctx.avgCycleDays > 0) {
    sims.push({
      ...base,
      title: `Cycle de vente : ${ctx.avgCycleDays}j → ${targetCycle}j en 90 jours`,
      description: `${subtitle}. Réduction de 20% du cycle = +20% de deals fermés sur la même période. Leviers : raccourcir le temps en chaque stage + e-sign + templates quote.`,
      impact: `~+${Math.round(ctx.wonDeals * 0.2)} deals gagnés / quarter à équipe constante`,
      category: "sales",
      color: "from-blue-500 to-cyan-600",
      forecastType: "cycle_days",
      threshold: targetCycle,
      direction: "below",
    });
  }

  // 2. Forecast pondéré actuel (gros bloc)
  if (ctx.openDeals >= 1) {
    sims.push({
      ...base,
      title: `Forecast pondéré : ${fmtK(ctx.totalWeightedAmount)} → ${fmtK(ctx.totalWeightedAmount * 1.2)} en 60 jours`,
      description: `${subtitle}. ${ctx.openDeals} deals ouverts pour ${fmtK(ctx.openAmount)} brut. Pondéré par probabilité = forecast réaliste. +20% via accélération deals stages avancés.`,
      impact: `+${fmtK(ctx.totalWeightedAmount * 0.2)} de forecast pondéré`,
      category: "sales",
      color: "from-indigo-500 to-purple-600",
      forecastType: "weighted_pipeline",
      threshold: Math.round(ctx.totalWeightedAmount * 1.2),
      direction: "above",
    });
  }

  // 3. Réduction noNextActivity (par stage)
  if (ctx.noNextActivityCount > 0) {
    sims.push({
      ...base,
      title: `Suivi pipeline : ${ctx.noNextActivityCount} deals sans next activity → 0 en 14 jours`,
      description: `${subtitle}. ${ctx.noNextActivityCount} deals ouverts sans next_activity_date. Workflow bloquant la sauvegarde sans next activity = effet immédiat.`,
      impact: `+${Math.round(ctx.noNextActivityCount * 0.7)} deals remis en suivi actif`,
      category: "sales",
      color: "from-cyan-500 to-blue-600",
      forecastType: "no_next_activity",
      threshold: 0,
      direction: "below",
    });
  }

  // 4. Stage le plus lent → accélération ciblée
  const slowestStage = [...ctx.byStage]
    .filter((s) => !s.closedWon && !s.closedLost && s.count > 0 && s.avgDaysInStage > 0)
    .sort((a, b) => b.avgDaysInStage - a.avgDaysInStage)[0];
  if (slowestStage && slowestStage.avgDaysInStage > 14) {
    const newTarget = Math.max(7, Math.round(slowestStage.avgDaysInStage * 0.6));
    sims.push({
      ...base,
      title: `Stage « ${slowestStage.stageLabel} » : ${slowestStage.avgDaysInStage}j moyenne → ${newTarget}j en 60 jours`,
      description: `Étape ralentit le pipeline (${slowestStage.count} deals, durée moyenne ${slowestStage.avgDaysInStage}j). Audit blocages : qualification, démo, négo. SLA dédié + escalade manager au-delà de ${newTarget}j.`,
      impact: `Cycle global -${Math.round((slowestStage.avgDaysInStage - newTarget) / 7)}j`,
      category: "sales",
      color: "from-blue-500 to-indigo-600",
      forecastType: "stage_velocity",
      threshold: newTarget,
      direction: "below",
    });
  }

  // 5. Rituel pipeline review hebdo (always-on, vital)
  sims.push({
    ...base,
    title: `Rituel pipeline review hebdo : 100% adoption en 14 jours`,
    description: `${subtitle}. 30min/semaine avec sales lead : top 5 deals chauds, deals à relancer, deals à clôturer. Réduit la stagnation de 50%.`,
    impact: "Pipeline assaini chaque semaine, forecast plus fiable",
    category: "sales",
    color: "from-indigo-500 to-blue-600",
    forecastType: "pipeline_review_ritual",
    threshold: 100,
    direction: "above",
  });

  // 6. Pipeline coverage
  const targetCoverage = Math.max(30, ctx.openDeals * 3);
  if (ctx.openDeals > 0 && ctx.openDeals < targetCoverage) {
    sims.push({
      ...base,
      title: `Pipeline coverage : ${ctx.openDeals} → ${targetCoverage} deals ouverts en 60 jours`,
      description: `${subtitle}. Règle CRO : pipeline = 3x objectif quarter. Mobilisation SDR + inbound combinée pour x3 le pipeline.`,
      impact: `+${targetCoverage - ctx.openDeals} deals ouverts, couverture forecast atteinte`,
      category: "sales",
      color: "from-fuchsia-500 to-purple-600",
      forecastType: "pipeline_volume",
      threshold: targetCoverage,
      direction: "above",
    });
  }

  // 7. Velocity score composite
  const velocityScore = ctx.avgCycleDays > 0 && ctx.openDeals > 0
    ? Math.round((ctx.openDeals / Math.max(ctx.avgCycleDays / 30, 1)) * 100) / 100
    : 0;
  if (velocityScore > 0) {
    sims.push({
      ...base,
      title: `Velocity score : ${velocityScore} → ${Math.round(velocityScore * 1.3 * 100) / 100} en 90 jours`,
      description: `Velocity = (deals ouverts × ticket moyen × win rate) / cycle. KPI #1 sales performant. +30% via levier le plus impactant (cycle, win rate, ticket).`,
      impact: "Croissance prédictible du revenue",
      category: "sales",
      color: "from-blue-500 to-fuchsia-600",
      forecastType: "velocity_score",
      threshold: Math.round(velocityScore * 1.3 * 100) / 100,
      direction: "above",
    });
  }

  return sims;
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATOR : DEALS À RISQUE
// ────────────────────────────────────────────────────────────────────────────

export function generateRiskSimulations(ctx: PipelineSelectionContext): SmartSimulation[] {
  const sims: SmartSimulation[] = [];
  const base = makeBase(ctx, "risk");
  const subtitle = stageSubtitle(ctx);

  // 1. Réduire les deals à risque
  if (ctx.atRiskCount > 0) {
    sims.push({
      ...base,
      title: `Deals à risque : ${ctx.atRiskCount} (${fmtK(ctx.atRiskAmount)}) → ${Math.max(0, Math.round(ctx.atRiskCount / 2))} en 30 jours`,
      description: `${subtitle}. ${ctx.atRiskCount} deals avec probabilité <30%. Plan d'action obligatoire sous 48h pour chacun (note + next_activity + escalade si Tier 1).`,
      impact: `Pipeline assaini, ${fmtK(ctx.atRiskAmount * 0.3)} d'amount sécurisé`,
      category: "sales",
      color: "from-rose-500 to-pink-600",
      forecastType: "at_risk_count",
      threshold: Math.max(0, Math.round(ctx.atRiskCount / 2)),
      direction: "below",
    });
  }

  // 2. Stagnation
  if (ctx.stagnantCount > 0) {
    sims.push({
      ...base,
      title: `Stagnation : ${ctx.stagnantCount} deals figés (${fmtK(ctx.stagnantAmount)}) → 0 en 14 jours`,
      description: `${subtitle}. ${ctx.stagnantCount} deals sans activité +7j et sans next_activity. War room hebdo : 1 décision/deal en 5min (relance OU lost).`,
      impact: `~+${Math.max(1, Math.round(ctx.stagnantCount * 0.3))} deals récupérés`,
      category: "sales",
      color: "from-rose-500 to-orange-600",
      forecastType: "stagnant_clear",
      threshold: 0,
      direction: "below",
    });
  }

  // 3. NoNextActivity
  if (ctx.noNextActivityCount > 0) {
    sims.push({
      ...base,
      title: `Deals sans next activity : ${ctx.noNextActivityCount} → 0 en 7 jours`,
      description: `${subtitle}. Workflow bloquant la sauvegarde sans next_activity_date sur deals ouverts. Discipline pipeline immédiate.`,
      impact: `${ctx.noNextActivityCount} deals remis en suivi proactif`,
      category: "sales",
      color: "from-rose-500 to-purple-600",
      forecastType: "no_next_activity_clear",
      threshold: 0,
      direction: "below",
    });
  }

  // 4. Stage avec le plus de risque
  const riskiestStage = [...ctx.byStage]
    .filter((s) => !s.closedWon && !s.closedLost && s.atRiskCount > 0)
    .sort((a, b) => b.atRiskAmount - a.atRiskAmount)[0];
  if (riskiestStage) {
    sims.push({
      ...base,
      title: `Stage « ${riskiestStage.stageLabel} » : ${riskiestStage.atRiskCount} deals à risque (${fmtK(riskiestStage.atRiskAmount)}) → -50% en 30 jours`,
      description: `Concentration de risque sur l'étape « ${riskiestStage.stageLabel} ». Audit causes profondes : qualification mauvaise en amont, blocage négo, no decision. Sprint focalisé.`,
      impact: `${fmtK(riskiestStage.atRiskAmount / 2)} d'amount sauvé`,
      category: "sales",
      color: "from-rose-500 to-orange-600",
      forecastType: "stage_risk",
      threshold: Math.max(0, Math.round(riskiestStage.atRiskCount / 2)),
      direction: "below",
    });
  }

  // 5. Score risque composite
  sims.push({
    ...base,
    title: `Score risque composite par deal : 100% deals scorés en 30 jours`,
    description: `${subtitle}. Score combinant : last_contacted, next_activity, probability, days_in_stage, sentiment. Notification CSM/Sales si score rouge.`,
    impact: "Détection proactive risque avant qu'il devienne critique",
    category: "sales",
    color: "from-rose-500 to-violet-600",
    forecastType: "risk_score_setup",
    threshold: 100,
    direction: "above",
  });

  // 6. Escalade Tier 1
  const tier1Threshold = ctx.avgDealAmount * 5; // Tier 1 = 5x le ticket moyen
  const tier1Stagnant = ctx.byStage.reduce(
    (count, s) => count + (s.stagnantAmount > tier1Threshold ? 1 : 0),
    0,
  );
  if (tier1Stagnant > 0 || ctx.avgDealAmount > 0) {
    sims.push({
      ...base,
      title: `Escalade manager : 100% deals Tier 1 (>${fmtK(tier1Threshold)}) stagnants 7j+ en 14 jours`,
      description: `${subtitle}. Workflow auto qui notifie le manager si deal Tier 1 stagne 7j+ sans next_activity. Action requise sous 48h.`,
      impact: "0 deal Tier 1 perdu par négligence",
      category: "sales",
      color: "from-rose-500 to-purple-600",
      forecastType: "tier1_escalation",
      threshold: 100,
      direction: "above",
    });
  }

  // 7. Ghost deals (close_date dans le passé)
  // (proxy via probability < 30 + close_date already passed)
  sims.push({
    ...base,
    title: `Ghost deals : 0 deals avec closedate dépassée en 14 jours`,
    description: `${subtitle}. Deals dont la closedate est dans le passé sans clôture = signaux de pipeline mort. Audit + décision binaire (réplanifier sérieusement OU lost).`,
    impact: "Forecast nettoyé, pipeline réaliste",
    category: "sales",
    color: "from-orange-500 to-rose-600",
    forecastType: "ghost_deals",
    threshold: 0,
    direction: "below",
  });

  // 8. Re-qualification
  if (ctx.openDeals > 10) {
    sims.push({
      ...base,
      title: `Re-qualification deals abandonnés > 30 jours : décision binaire en 7j`,
      description: `${subtitle}. Liste deals sans activité > 30j. Sprint dédié : pour chacun, soit relance avec plan clair, soit clôture lost avec lost_reason.`,
      impact: "Pipeline assaini + lost_reasons trackés pour amélioration",
      category: "sales",
      color: "from-orange-500 to-amber-600",
      forecastType: "abandoned_decision",
      threshold: 0,
      direction: "below",
    });
  }

  return sims;
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATOR : FORECAST CA
// ────────────────────────────────────────────────────────────────────────────

export function generateForecastSimulations(ctx: PipelineSelectionContext): SmartSimulation[] {
  const sims: SmartSimulation[] = [];
  const base = makeBase(ctx, "forecast");
  const subtitle = stageSubtitle(ctx);

  // 1. Forecast 30 jours
  if (ctx.forecastNext30Days > 0) {
    sims.push({
      ...base,
      title: `Forecast 30j : ${fmtK(ctx.forecastNext30Days)} → +20% en 30 jours`,
      description: `${subtitle}. Forecast pondéré sur deals avec closedate ≤30j. Levier : accélération deals stages avancés (Proposition, Négociation) + relances ciblées.`,
      impact: `+${fmtK(ctx.forecastNext30Days * 0.2)} sur le mois`,
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: "forecast_30d",
      threshold: Math.round(ctx.forecastNext30Days * 1.2),
      direction: "above",
    });
  }

  // 2. Forecast 90 jours / quarter
  if (ctx.forecastNext90Days > 0) {
    sims.push({
      ...base,
      title: `Forecast quarter : ${fmtK(ctx.forecastNext90Days)} → ${fmtK(ctx.forecastNext90Days * 1.15)} en 90 jours`,
      description: `${subtitle}. Forecast pondéré sur deals avec closedate ≤90j. +15% via combinaison closing rate + accélération + nouveaux deals créés.`,
      impact: `+${fmtK(ctx.forecastNext90Days * 0.15)} ce quarter`,
      category: "sales",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "forecast_90d",
      threshold: Math.round(ctx.forecastNext90Days * 1.15),
      direction: "above",
    });
  }

  // 3. Forecast accuracy discipline
  sims.push({
    ...base,
    title: `Forecast accuracy : 90%+ en 60 jours`,
    description: `${subtitle}. Audit hebdo écart forecast vs réalisé par stage. Discipline sales : pas de forecast sans next_activity + amount + closedate.`,
    impact: "Direction commerciale alignée + planification fiabilisée",
    category: "sales",
    color: "from-cyan-500 to-emerald-600",
    forecastType: "forecast_accuracy",
    threshold: 90,
    direction: "above",
  });

  // 4. Forecast par stage avancé (top 3 stages les plus chauds)
  const hotStages = [...ctx.byStage]
    .filter((s) => !s.closedWon && !s.closedLost && s.probability >= 50 && s.amount > 0)
    .sort((a, b) => b.weightedAmount - a.weightedAmount)
    .slice(0, 3);
  for (const stage of hotStages) {
    sims.push({
      ...base,
      title: `Stage « ${stage.stageLabel} » : ${fmtK(stage.weightedAmount)} pondéré → +30% en 60 jours`,
      description: `Étape à fort potentiel (${stage.count} deals × ${stage.probability}% probability = ${fmtK(stage.weightedAmount)}). Sprint accélération : revue 1-by-1 avec sales lead, déblocage objections.`,
      impact: `+${fmtK(stage.weightedAmount * 0.3)} de forecast pondéré`,
      category: "sales",
      color: "from-emerald-500 to-blue-600",
      forecastType: `stage_forecast_${stage.stageId}`,
      threshold: Math.round(stage.weightedAmount * 1.3),
      direction: "above",
    });
  }

  // 5. Pipeline value 3x objectif
  const target3x = Math.max(ctx.openAmount * 1.5, 100000);
  if (ctx.openAmount > 0 && ctx.openAmount < target3x) {
    sims.push({
      ...base,
      title: `Pipeline value : ${fmtK(ctx.openAmount)} → ${fmtK(target3x)} en 60 jours (3x quarter)`,
      description: `${subtitle}. Règle CRO : pipeline ouvert = 3x objectif revenue trimestre. Mobilisation acquisition (SDR + inbound + ABM).`,
      impact: "Couverture forecast atteinte, marge d'erreur acceptable",
      category: "sales",
      color: "from-emerald-500 to-blue-600",
      forecastType: "pipeline_3x",
      threshold: target3x,
      direction: "above",
    });
  }

  // 6. Closing date discipline
  sims.push({
    ...base,
    title: `Closedate discipline : 100% des deals open avec closedate < 90j en 30 jours`,
    description: `${subtitle}. Champ closedate obligatoire dès stage Qualification. Workflow alerte si closedate vide ou >180j sur deal actif.`,
    impact: "Forecast par mois/quarter possible et fiable",
    category: "sales",
    color: "from-cyan-500 to-blue-600",
    forecastType: "closedate_discipline",
    threshold: 100,
    direction: "above",
  });

  // 7. Closing rate vs target
  const closingTarget = Math.min(50, Math.max(ctx.closingRate + 10, 30));
  if (ctx.closingRate < closingTarget) {
    sims.push({
      ...base,
      title: `Closing rate : ${ctx.closingRate}% → ${closingTarget}% en 90 jours`,
      description: `${subtitle}. ${ctx.wonDeals} deals gagnés / ${ctx.wonDeals + ctx.lostDeals} clôturés. Action : MEDDIC en stage Qualification + disqualifier 30% à la Discovery.`,
      impact: `~+${Math.max(1, Math.round((ctx.wonDeals + ctx.lostDeals) * (closingTarget - ctx.closingRate) / 100))} deals gagnés / quarter`,
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: "closing_rate_forecast",
      threshold: closingTarget,
      direction: "above",
    });
  }

  return sims;
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATOR : CA ANALYTICS
// ────────────────────────────────────────────────────────────────────────────

export function generateCaAnalyticsSimulations(ctx: PipelineSelectionContext): SmartSimulation[] {
  const sims: SmartSimulation[] = [];
  const base = makeBase(ctx, "analytics");
  const subtitle = stageSubtitle(ctx);

  // 1. CA gagné cumulé
  if (ctx.wonDeals > 0) {
    sims.push({
      ...base,
      title: `CA gagné : ${fmtK(ctx.wonAmount)} cumulés → +20% en 90 jours`,
      description: `${subtitle}. ${ctx.wonDeals} deals gagnés. Cible : +20% du run rate via combo closing rate + ticket moyen + volume deals créés.`,
      impact: `+${fmtK(ctx.wonAmount * 0.2)} cumulés`,
      category: "sales",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "won_amount_growth",
      threshold: Math.round(ctx.wonAmount * 1.2),
      direction: "above",
    });
  }

  // 2. Ticket moyen
  if (ctx.wonDeals > 0) {
    const avgWon = Math.round(ctx.wonAmount / ctx.wonDeals);
    const avgWonTarget = Math.round(avgWon * 1.15);
    sims.push({
      ...base,
      title: `Ticket moyen : ${fmtK(avgWon)} → ${fmtK(avgWonTarget)} en 90 jours (+15%)`,
      description: `${subtitle}. Pricing tiers + bundling + démo features avancées en Discovery. Cibler upsell sur les deals fermables.`,
      impact: `+${fmtK(avgWonTarget - avgWon)}/deal × ${ctx.wonDeals} deals`,
      category: "sales",
      color: "from-emerald-500 to-blue-600",
      forecastType: "avg_deal_size",
      threshold: avgWonTarget,
      direction: "above",
    });
  }

  // 3. Win rate par stage (analyse drop-off)
  const dropoffStage = [...ctx.byStage]
    .filter((s) => !s.closedWon && !s.closedLost && s.probability < 50 && s.count > 5)
    .sort((a, b) => b.count - a.count)[0];
  if (dropoffStage) {
    sims.push({
      ...base,
      title: `Drop-off stage « ${dropoffStage.stageLabel} » : -30% en 60 jours`,
      description: `${dropoffStage.count} deals bloqués au stage avec probabilité ${dropoffStage.probability}%. Coaching ciblé sur cette transition + role-plays + script optimisé.`,
      impact: `+${Math.round(dropoffStage.count * 0.3)} deals avancés au stage suivant`,
      category: "sales",
      color: "from-amber-500 to-emerald-600",
      forecastType: "stage_dropoff",
      threshold: Math.max(0, Math.round(dropoffStage.count * 0.7)),
      direction: "below",
    });
  }

  // 4. Conversion stage-to-stage globale
  const openStages = ctx.byStage.filter((s) => !s.closedWon && !s.closedLost && s.count > 0);
  if (openStages.length >= 2) {
    sims.push({
      ...base,
      title: `Conversion stage-to-stage : audit complet en 30 jours`,
      description: `${subtitle}. Construire un rapport HubSpot stage-to-stage conversion sur les ${openStages.length} stages actifs. Identifier la pire transition pour coaching ciblé.`,
      impact: "Coaching data-driven sur le bon point de friction",
      category: "sales",
      color: "from-emerald-500 to-amber-600",
      forecastType: "stage_conversion_audit",
      threshold: 0,
      direction: "above",
    });
  }

  // 5. Win rate global
  if (ctx.closingRate > 0) {
    const closingTarget = Math.min(50, Math.max(ctx.closingRate + 10, 30));
    sims.push({
      ...base,
      title: `Win rate analytics : ${ctx.closingRate}% → ${closingTarget}% en 90 jours`,
      description: `${subtitle}. Analyser win rate par segment (taille, secteur, source) → identifier top 3 ICP → ré-allouer 80% du budget acquisition.`,
      impact: `~+${Math.max(1, Math.round((ctx.wonDeals + ctx.lostDeals) * (closingTarget - ctx.closingRate) / 100))} deals gagnés / quarter`,
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: "win_rate_segments",
      threshold: closingTarget,
      direction: "above",
    });
  }

  // 6. Source ROI analytics
  sims.push({
    ...base,
    title: `Attribution source par deal : 100% deals avec hs_analytics_source en 30 jours`,
    description: `${subtitle}. Workflow obligeant à renseigner la source à la création deal. Reporting mensuel revenue par canal (inbound, outbound, referral, partner).`,
    impact: "ROI marketing mesurable, ré-allocation budget facilitée",
    category: "sales",
    color: "from-emerald-500 to-fuchsia-600",
    forecastType: "source_attribution",
    threshold: 100,
    direction: "above",
  });

  // 7. CA par sales (analyse perf)
  sims.push({
    ...base,
    title: `Ranking CA par sales : top 3 vs bottom 3 en 30 jours`,
    description: `${subtitle}. Reporting CA + nombre deals + win rate par sales. Mentor pairing top→bottom pour transmission best practices.`,
    impact: "Niveau d'équipe relevé via partage des bonnes pratiques",
    category: "sales",
    color: "from-emerald-500 to-purple-600",
    forecastType: "sales_ranking",
    threshold: 0,
    direction: "above",
  });

  // 8. Cohort retention (si CSM angle pertinent — pas pour pipeline new business)
  if (ctx.wonDeals >= 5) {
    sims.push({
      ...base,
      title: `LTV par cohort : analyse en 60 jours`,
      description: `${subtitle}. Calculer revenue généré par mois × cohort signature. Identifier les meilleures cohorts pour répliquer les conditions de signature.`,
      impact: "Modèle SaaS optimisé sur les conditions de meilleur LTV",
      category: "csm",
      color: "from-emerald-500 to-cyan-600",
      forecastType: "ltv_cohort",
      threshold: 0,
      direction: "above",
    });
  }

  return sims;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
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
  return {
    velocity: generateVelocitySimulations(context),
    risk: generateRiskSimulations(context),
    forecast: generateForecastSimulations(context),
    analytics: generateCaAnalyticsSimulations(context),
    context,
  };
}
