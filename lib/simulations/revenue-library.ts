/**
 * Bibliothèque de simulations Revenue par pipeline — Phase 8.7
 *
 * Architecture identique à cycle-ventes-library : pure functions + generators.
 * Différence : focus sur les métriques REVENUE (won amount, MRR, deal size,
 * pipeline value, forecast cash, LTV proxy) plutôt que vélocité/risque.
 *
 * Le pipeline détermine fortement les simulations :
 *   - New Business pipeline : focus won amount, ticket moyen, run rate
 *   - Renewal pipeline : focus retention, NRR, churn rate
 *   - Upsell pipeline : focus expansion MRR, cross-sell
 */

import type { PipelineInfo } from "@/lib/integrations/hubspot-snapshot";
import type { DealLite, SmartSimulation as BaseSmartSim } from "./cycle-ventes-library";

export type RevenuePipelineContext = {
  pipeline: PipelineInfo;

  // Volume
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;

  // Revenue
  wonAmount: number;
  openAmount: number;
  lostAmount: number;
  weightedPipeline: number; // sum amount × probability sur open

  // Ticket moyen
  avgWonAmount: number;
  avgOpenAmount: number;

  // Closing rate
  closingRate: number; // 0..100

  // Forecast time-based
  forecastNext30Days: number; // pondéré
  forecastNext90Days: number; // pondéré
  forecastNext30DaysGross: number; // brut sur deals avec closedate ≤30j
  forecastNext90DaysGross: number;

  // Distribution
  topDealAmount: number; // plus gros deal won
  bottomDealAmount: number; // plus petit deal won (>0)
  medianWonAmount: number;

  // Hypothèse heuristique sur le type de pipeline (basée sur le nom)
  inferredType: "new_business" | "renewal" | "upsell" | "other";
};

export type RevenueSmartSim = Omit<BaseSmartSim, "section" | "selectedStageIds" | "id"> & {
  section: "growth" | "ticket" | "forecast" | "retention";
  id?: string;
  // Revenue n'utilise pas de filtre stages — tout le pipeline est concerné
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const fmtK = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M€`
    : n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

function inferPipelineType(label: string): RevenuePipelineContext["inferredType"] {
  const l = label.toLowerCase();
  if (l.includes("renewal") || l.includes("renouvel") || l.includes("retention")) return "renewal";
  if (l.includes("upsell") || l.includes("expansion") || l.includes("cross")) return "upsell";
  if (l.includes("new") || l.includes("acqui") || l.includes("ventes") || l.includes("sales") || l.includes("prospect")) {
    return "new_business";
  }
  return "other";
}

// ────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// ────────────────────────────────────────────────────────────────────────────

export function buildRevenuePipelineContext(
  pipeline: PipelineInfo,
  deals: DealLite[],
): RevenuePipelineContext {
  const wonStages = new Set(pipeline.stages.filter((s) => s.closedWon).map((s) => s.id));
  const lostStages = new Set(pipeline.stages.filter((s) => s.closedLost).map((s) => s.id));
  const openStages = new Set(pipeline.stages.filter((s) => !s.closedWon && !s.closedLost).map((s) => s.id));
  const stageProb = new Map(pipeline.stages.map((s) => [s.id, s.probability / 100]));

  const wonList = deals.filter((d) => wonStages.has(d.dealstage));
  const lostList = deals.filter((d) => lostStages.has(d.dealstage));
  const openList = deals.filter((d) => openStages.has(d.dealstage));

  const wonAmount = wonList.reduce((s, d) => s + d.amount, 0);
  const openAmount = openList.reduce((s, d) => s + d.amount, 0);
  const lostAmount = lostList.reduce((s, d) => s + d.amount, 0);
  const weightedPipeline = openList.reduce(
    (s, d) => s + d.amount * (stageProb.get(d.dealstage) ?? d.probability ?? 0),
    0,
  );

  const wonAmounts = wonList.map((d) => d.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const medianWonAmount = wonAmounts.length > 0
    ? wonAmounts[Math.floor(wonAmounts.length / 2)]
    : 0;

  const now = Date.now();
  const next30 = now + THIRTY_DAYS_MS;
  const next90 = now + NINETY_DAYS_MS;

  const dealsClosing30 = openList.filter((d) => d.closedate && new Date(d.closedate).getTime() <= next30);
  const dealsClosing90 = openList.filter((d) => d.closedate && new Date(d.closedate).getTime() <= next90);

  const forecastNext30Days = dealsClosing30.reduce((s, d) => s + d.amount * (stageProb.get(d.dealstage) ?? d.probability ?? 0), 0);
  const forecastNext90Days = dealsClosing90.reduce((s, d) => s + d.amount * (stageProb.get(d.dealstage) ?? d.probability ?? 0), 0);
  const forecastNext30DaysGross = dealsClosing30.reduce((s, d) => s + d.amount, 0);
  const forecastNext90DaysGross = dealsClosing90.reduce((s, d) => s + d.amount, 0);

  const closedTotal = wonList.length + lostList.length;
  return {
    pipeline,
    totalDeals: deals.length,
    openDeals: openList.length,
    wonDeals: wonList.length,
    lostDeals: lostList.length,
    wonAmount,
    openAmount,
    lostAmount,
    weightedPipeline,
    avgWonAmount: wonList.length > 0 ? Math.round(wonAmount / wonList.length) : 0,
    avgOpenAmount: openList.length > 0 ? Math.round(openAmount / openList.length) : 0,
    closingRate: closedTotal > 0 ? Math.round((wonList.length / closedTotal) * 100) : 0,
    forecastNext30Days,
    forecastNext90Days,
    forecastNext30DaysGross,
    forecastNext90DaysGross,
    topDealAmount: wonAmounts.length > 0 ? wonAmounts[wonAmounts.length - 1] : 0,
    bottomDealAmount: wonAmounts.length > 0 ? wonAmounts[0] : 0,
    medianWonAmount,
    inferredType: inferPipelineType(pipeline.label),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ────────────────────────────────────────────────────────────────────────────

function makeBase(ctx: RevenuePipelineContext, section: RevenueSmartSim["section"]) {
  return {
    simulationCategory: "cycle_ventes" as const, // techniquement on garde le même DB column
    section,
    pipelineId: ctx.pipeline.id,
    pipelineLabel: ctx.pipeline.label,
  };
}

export function generateRevenueSimulations(ctx: RevenuePipelineContext): RevenueSmartSim[] {
  const sims: RevenueSmartSim[] = [];
  const subtitle = `Pipeline « ${ctx.pipeline.label} »`;

  // ─── GROWTH (revenue cumulé + run rate) ─────────────────────
  if (ctx.wonAmount > 0) {
    sims.push({
      ...makeBase(ctx, "growth"),
      title: `CA cumulé : ${fmtK(ctx.wonAmount)} → ${fmtK(ctx.wonAmount * 1.2)} en 90 jours (+20%)`,
      description: `${subtitle}. ${ctx.wonDeals} deals gagnés. Cible top quartile B2B : +20% du run rate via combo closing rate × ticket moyen × volume deals.`,
      impact: `+${fmtK(ctx.wonAmount * 0.2)} de CA cumulé`,
      category: "sales",
      color: "from-emerald-500 to-cyan-600",
      forecastType: `won_amount_growth_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.wonAmount * 1.2),
      direction: "above",
    });
  }

  if (ctx.weightedPipeline > 0) {
    sims.push({
      ...makeBase(ctx, "growth"),
      title: `Pipeline pondéré : ${fmtK(ctx.weightedPipeline)} → ${fmtK(ctx.weightedPipeline * 1.3)} en 60 jours (+30%)`,
      description: `${subtitle}. ${ctx.openDeals} deals ouverts × probabilité = ${fmtK(ctx.weightedPipeline)} de forecast pondéré. Levier #1 : alimentation pipeline + accélération stages avancés.`,
      impact: `+${fmtK(ctx.weightedPipeline * 0.3)} de forecast pondéré`,
      category: "sales",
      color: "from-emerald-500 to-blue-600",
      forecastType: `weighted_pipeline_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.weightedPipeline * 1.3),
      direction: "above",
    });
  }

  if (ctx.openAmount > 0) {
    const target3x = Math.max(ctx.openAmount * 1.5, 100000);
    sims.push({
      ...makeBase(ctx, "growth"),
      title: `Pipeline value : ${fmtK(ctx.openAmount)} → ${fmtK(target3x)} en 60 jours (3x quarter)`,
      description: `${subtitle}. Règle CRO : pipeline ouvert = 3x objectif revenue trimestre. Mobilisation acquisition (SDR + inbound + ABM).`,
      impact: "Couverture forecast atteinte, marge d'erreur acceptable",
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: `pipeline_3x_${ctx.pipeline.id}`,
      threshold: target3x,
      direction: "above",
    });
  }

  // ─── TICKET (deal size, distribution) ──────────────────────
  if (ctx.avgWonAmount > 0) {
    sims.push({
      ...makeBase(ctx, "ticket"),
      title: `Ticket moyen : ${fmtK(ctx.avgWonAmount)} → ${fmtK(Math.round(ctx.avgWonAmount * 1.15))} en 90 jours (+15%)`,
      description: `${subtitle}. Pricing tiers + bundling + démo features avancées en Discovery. Cibler upsell sur les deals fermables.`,
      impact: `+${fmtK(Math.round(ctx.avgWonAmount * 0.15))}/deal × ${ctx.wonDeals} deals projetés`,
      category: "sales",
      color: "from-emerald-500 to-blue-600",
      forecastType: `avg_deal_size_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.avgWonAmount * 1.15),
      direction: "above",
    });
  }

  if (ctx.medianWonAmount > 0 && ctx.avgWonAmount > 0 && ctx.avgWonAmount > ctx.medianWonAmount * 1.5) {
    // Distribution skewée par quelques gros deals → opportunity tail
    sims.push({
      ...makeBase(ctx, "ticket"),
      title: `Tail revenue : 80% du CA via 20% deals — diversifier en 90 jours`,
      description: `${subtitle}. Ticket moyen ${fmtK(ctx.avgWonAmount)} mais médiane ${fmtK(ctx.medianWonAmount)}. Risque : revenue concentré sur peu de gros deals. Cible : diversifier vers des deals médiums.`,
      impact: "Revenue plus prédictible, moins exposé aux gros lost",
      category: "sales",
      color: "from-amber-500 to-emerald-600",
      forecastType: `tail_diversification_${ctx.pipeline.id}`,
      threshold: 0,
      direction: "above",
    });
  }

  if (ctx.topDealAmount > 0) {
    sims.push({
      ...makeBase(ctx, "ticket"),
      title: `Top deal historique : ${fmtK(ctx.topDealAmount)} — répliquer 3 deals similaires en 6 mois`,
      description: `${subtitle}. Plus gros deal gagné = ${fmtK(ctx.topDealAmount)}. Audit conditions de signature (taille compte, secteur, persona, durée cycle) pour répliquer.`,
      impact: `+${fmtK(ctx.topDealAmount * 3)} potentiel sur 6 mois`,
      category: "sales",
      color: "from-emerald-500 to-purple-600",
      forecastType: `top_deal_replication_${ctx.pipeline.id}`,
      threshold: 3,
      direction: "above",
    });
  }

  // ─── FORECAST CASH ──────────────────────────────────────────
  if (ctx.forecastNext30Days > 0) {
    sims.push({
      ...makeBase(ctx, "forecast"),
      title: `Forecast cash 30j : ${fmtK(ctx.forecastNext30Days)} → +20% en 30 jours`,
      description: `${subtitle}. Forecast pondéré sur deals avec closedate ≤30j. Levier : accélération signature (templates quote, e-sign, relance).`,
      impact: `+${fmtK(ctx.forecastNext30Days * 0.2)} de cash sur le mois`,
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: `forecast_30d_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.forecastNext30Days * 1.2),
      direction: "above",
    });
  }

  if (ctx.forecastNext90Days > 0) {
    sims.push({
      ...makeBase(ctx, "forecast"),
      title: `Forecast cash quarter : ${fmtK(ctx.forecastNext90Days)} → ${fmtK(ctx.forecastNext90Days * 1.15)} en 90 jours`,
      description: `${subtitle}. Forecast pondéré sur deals avec closedate ≤90j. +15% via combinaison closing rate + accélération + nouveaux deals créés.`,
      impact: `+${fmtK(ctx.forecastNext90Days * 0.15)} ce quarter`,
      category: "sales",
      color: "from-emerald-500 to-cyan-600",
      forecastType: `forecast_90d_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.forecastNext90Days * 1.15),
      direction: "above",
    });
  }

  if (ctx.forecastNext90DaysGross > 0 && ctx.forecastNext90Days < ctx.forecastNext90DaysGross * 0.4) {
    // Beaucoup de deals avec closedate proche mais pondération basse = stages early
    sims.push({
      ...makeBase(ctx, "forecast"),
      title: `Quality forecast : ${fmtK(ctx.forecastNext90DaysGross)} brut → ${fmtK(ctx.forecastNext90Days)} pondéré (gap)`,
      description: `${subtitle}. Beaucoup de deals avec closedate proche mais aux stages early (faible probabilité). Faire avancer ces deals au stage suivant ou réplanifier closedate.`,
      impact: "Forecast plus crédible, alignement direction commerciale",
      category: "sales",
      color: "from-cyan-500 to-emerald-600",
      forecastType: `forecast_quality_${ctx.pipeline.id}`,
      threshold: Math.round(ctx.forecastNext90Days * 1.5),
      direction: "above",
    });
  }

  sims.push({
    ...makeBase(ctx, "forecast"),
    title: `Forecast accuracy : 90%+ en 60 jours`,
    description: `${subtitle}. Audit hebdo écart forecast vs réalisé par stage. Discipline sales : pas de forecast sans next_activity + amount + closedate.`,
    impact: "Direction commerciale alignée + planification fiabilisée",
    category: "sales",
    color: "from-cyan-500 to-emerald-600",
    forecastType: `forecast_accuracy_${ctx.pipeline.id}`,
    threshold: 90,
    direction: "above",
  });

  // ─── RETENTION / EXPANSION (selon type de pipeline inféré) ──
  if (ctx.inferredType === "renewal") {
    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Retention rate : ${ctx.closingRate}% → 95%+ en 90 jours`,
      description: `${subtitle}. Pipeline de renouvellement détecté. Cible top quartile B2B SaaS : 95%+ de retention. Workflow alerte CSM J-90 + plan d'engagement.`,
      impact: `+${Math.max(1, Math.round(ctx.openDeals * 0.1))} renouvellements sécurisés`,
      category: "csm",
      color: "from-emerald-500 to-fuchsia-600",
      forecastType: `retention_rate_${ctx.pipeline.id}`,
      threshold: 95,
      direction: "above",
    });

    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Net Revenue Retention : 100%+ en 12 mois (expansion > churn)`,
      description: `${subtitle}. NRR = (MRR_début + expansion - churn - downgrade) / MRR_début. > 100% = croissance même sans new business. Modèle SaaS premium.`,
      impact: "Modèle SaaS sain, valorisation x10 vs churn négatif",
      category: "csm",
      color: "from-teal-500 to-emerald-600",
      forecastType: `nrr_${ctx.pipeline.id}`,
      threshold: 100,
      direction: "above",
    });
  } else if (ctx.inferredType === "upsell") {
    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Expansion MRR : +10% en 90 jours via upsell`,
      description: `${subtitle}. Pipeline upsell détecté. Détection auto comptes prêts (usage croissant + NPS promoteur). Workflow d'alerte CSM expansion.`,
      impact: "+10% MRR sans coût d'acquisition (CAC payback immédiat)",
      category: "csm",
      color: "from-emerald-500 to-fuchsia-600",
      forecastType: `expansion_mrr_${ctx.pipeline.id}`,
      threshold: 10,
      direction: "above",
    });

    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Cross-sell : 1 produit additionnel par customer en 6 mois`,
      description: `${subtitle}. Map produits par persona + déclencheurs upsell auto. Cible : 30% des customers avec 2+ produits actifs en 6 mois.`,
      impact: "Expansion revenue sans coût acquisition",
      category: "csm",
      color: "from-emerald-500 to-purple-600",
      forecastType: `cross_sell_${ctx.pipeline.id}`,
      threshold: 30,
      direction: "above",
    });
  } else {
    // New business OR other : focus run rate + sources
    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Win rate : ${ctx.closingRate}% → ${Math.min(50, Math.max(ctx.closingRate + 10, 30))}% en 90 jours`,
      description: `${subtitle}. ${ctx.wonDeals} gagnés / ${ctx.wonDeals + ctx.lostDeals} clôturés. Action : MEDDIC en stage Qualification + disqualifier 30% à la Discovery.`,
      impact: `~+${Math.max(1, Math.round((ctx.wonDeals + ctx.lostDeals) * 0.1))} deals gagnés / quarter`,
      category: "sales",
      color: "from-emerald-500 to-teal-600",
      forecastType: `win_rate_${ctx.pipeline.id}`,
      threshold: Math.min(50, Math.max(ctx.closingRate + 10, 30)),
      direction: "above",
    });

    if (ctx.lostAmount > 0) {
      sims.push({
        ...makeBase(ctx, "retention"),
        title: `Win-back lost : 5% de ${fmtK(ctx.lostAmount)} récupéré en 60 jours`,
        description: `${subtitle}. Campagne dédiée sur les deals perdus depuis 6-12 mois. Stat : 5-10% de récupération possible avec une nouvelle approche.`,
        impact: `+${fmtK(ctx.lostAmount * 0.05)} potentiellement récupéré`,
        category: "sales",
        color: "from-amber-500 to-emerald-600",
        forecastType: `winback_${ctx.pipeline.id}`,
        threshold: Math.round(ctx.lostAmount * 0.05),
        direction: "above",
      });
    }

    sims.push({
      ...makeBase(ctx, "retention"),
      title: `Programme référencement : 10% revenue via réf en 12 mois`,
      description: `${subtitle}. Demande réf systématique post-success. Tracking sales attribuant chaque deal à la source réf si applicable.`,
      impact: "10% revenue sans CAC = marge nette quasi-pure",
      category: "csm",
      color: "from-fuchsia-500 to-emerald-600",
      forecastType: `referral_revenue_${ctx.pipeline.id}`,
      threshold: 10,
      direction: "above",
    });
  }

  return sims;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ────────────────────────────────────────────────────────────────────────────

export type RevenueSimulationsResult = {
  context: RevenuePipelineContext;
  sims: RevenueSmartSim[];
};

export function buildRevenueSimulations(
  pipeline: PipelineInfo,
  deals: DealLite[],
): RevenueSimulationsResult {
  const context = buildRevenuePipelineContext(pipeline, deals);
  const sims = generateRevenueSimulations(context);
  return { context, sims };
}
