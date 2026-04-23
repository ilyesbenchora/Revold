/**
 * Taux de conversion pipeline — méthode "étapes clés".
 *
 * Le constat CRO : la plupart des pipelines B2B ont 6–10 étapes, mais les
 * deals ne stationnent en réalité que dans 2–5 d'entre elles (les autres
 * sont des étapes administratives traversées en quelques heures). Calculer
 * une conversion "stage par stage" sur le pipeline brut donne des résultats
 * sans signal (0 deal → 0% conversion partout).
 *
 * Méthode :
 *   1. On ne garde que les étapes "clés" — celles où il y a au moins 1 deal
 *      ouvert actuellement.
 *   2. reached[i] = somme des deals dans key_stage[i] et tous les key_stages
 *      qui suivent (un deal en stage 4 a forcément traversé stage 2 et 3).
 *   3. conversion(i → i+1) = reached[i+1] / reached[i].
 *
 * Avantages :
 *   - Aucun appel HubSpot supplémentaire (réutilise PipelineAnalytics).
 *   - Pas de dépendance à `hs_date_entered_<stage>` (peu fiable, vide pour
 *     les deals créés via API).
 *   - Affiche le funnel RÉEL — ce qu'un RevOps regarde pour repérer un
 *     goulot d'étranglement.
 */

import type { PipelineAnalytics, HsPipeline } from "./hubspot-pipelines";

export type StageConversion = {
  stage: { id: string; label: string; displayOrder: number };
  inStageCount: number;
  reachedCount: number;
  conversionToNextPct: number | null;
  nextStageLabel: string | null;
};

export type PipelineConversion = {
  pipeline: HsPipeline;
  /** Nombre total d'étapes définies dans le pipeline HubSpot. */
  totalStages: number;
  /** Nombre d'étapes "clés" effectivement utilisées (avec au moins 1 deal). */
  keyStagesCount: number;
  stages: StageConversion[];
  /** Volume entré dans la 1ère étape clé. */
  totalEntries: number;
  /** Conversion globale 1ère étape clé → dernière étape clé. */
  endToEndPct: number | null;
  /** True quand on a < 2 étapes peuplées (pas assez pour calculer). */
  insufficientStages: boolean;
};

export function buildPipelineConversion(pa: PipelineAnalytics): PipelineConversion {
  const allOrdered = [...pa.pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);

  // Map stageId → dealCount à partir de PipelineAnalytics.stages (déjà filtré
  // par dealCount > 0)
  const countByStage = new Map<string, number>();
  for (const s of pa.stages) countByStage.set(s.stage.id, s.dealCount);

  // Étapes clés = celles où des deals sont actuellement stockés
  const keyStages = allOrdered.filter((s) => (countByStage.get(s.id) ?? 0) > 0);

  if (keyStages.length < 2) {
    return {
      pipeline: pa.pipeline,
      totalStages: allOrdered.length,
      keyStagesCount: keyStages.length,
      stages: keyStages.map((s) => ({
        stage: { id: s.id, label: s.label, displayOrder: s.displayOrder },
        inStageCount: countByStage.get(s.id) ?? 0,
        reachedCount: countByStage.get(s.id) ?? 0,
        conversionToNextPct: null,
        nextStageLabel: null,
      })),
      totalEntries: keyStages[0] ? countByStage.get(keyStages[0].id) ?? 0 : 0,
      endToEndPct: null,
      insufficientStages: true,
    };
  }

  // Cumul reached depuis la fin (un deal en key_stage[k] est passé par
  // key_stage[k-1], k-2, ..., 0)
  const reachedFromEnd: number[] = new Array(keyStages.length).fill(0);
  let cumul = 0;
  for (let i = keyStages.length - 1; i >= 0; i--) {
    cumul += countByStage.get(keyStages[i].id) ?? 0;
    reachedFromEnd[i] = cumul;
  }

  const stages: StageConversion[] = keyStages.map((s, i) => {
    const inStage = countByStage.get(s.id) ?? 0;
    const reached = reachedFromEnd[i];
    const next = keyStages[i + 1] ?? null;
    const reachedNext = next ? reachedFromEnd[i + 1] : null;
    const conversionToNextPct =
      next && reached > 0 && reachedNext !== null
        ? Math.round((reachedNext / reached) * 100)
        : null;
    return {
      stage: { id: s.id, label: s.label, displayOrder: s.displayOrder },
      inStageCount: inStage,
      reachedCount: reached,
      conversionToNextPct,
      nextStageLabel: next?.label ?? null,
    };
  });

  const totalEntries = stages[0]?.reachedCount ?? 0;
  const lastReached = stages[stages.length - 1]?.reachedCount ?? 0;
  const endToEndPct =
    totalEntries > 0 ? Math.round((lastReached / totalEntries) * 100) : null;

  return {
    pipeline: pa.pipeline,
    totalStages: allOrdered.length,
    keyStagesCount: keyStages.length,
    stages,
    totalEntries,
    endToEndPct,
    insufficientStages: false,
  };
}
