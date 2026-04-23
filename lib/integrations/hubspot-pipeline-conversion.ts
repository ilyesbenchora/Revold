/**
 * Taux de conversion étape par étape — version SNAPSHOT INSTANT-T.
 *
 * Méthode (validée RevOps) :
 *   - On part de l'analyse pipeline déjà calculée (PipelineAnalytics) qui
 *     donne, pour chaque étape, le nombre de deals OUVERTS actuellement
 *     dans cette étape.
 *   - "Reached stage[i]" = somme des deals dans stage[i] + tous les stages
 *     suivants (un deal en stage[3] est passé par stage[1] et stage[2]).
 *   - conversion(i → i+1) = reached[i+1] / reached[i].
 *
 * Avantages :
 *   - Aucun appel HubSpot supplémentaire (réutilise les données déjà fetchées).
 *   - Pas de dépendance à `hs_date_entered_<stage>` (HAS_PROPERTY peu fiable
 *     sur certains portails et oblige à attendre que HubSpot ait écrit la
 *     propriété — souvent vide pour les deals créés via API).
 *   - Reflète la forme RÉELLE du pipeline à l'instant T — exactement ce
 *     qu'un RevOps regarde pour repérer un goulot d'étranglement.
 */

import type { HsPipeline, PipelineAnalytics } from "./hubspot-pipelines";

export type StageConversion = {
  stage: { id: string; label: string; displayOrder: number };
  inStageCount: number;       // deals actuellement DANS cette étape
  reachedCount: number;       // deals dans cette étape OU au-delà (= ont atteint cette étape)
  conversionToNextPct: number | null;
  nextStageLabel: string | null;
};

export type PipelineConversion = {
  pipeline: HsPipeline;
  stages: StageConversion[];
  totalEntries: number;        // = reached[0]
  endToEndPct: number | null;
};

/**
 * Calcule la conversion à partir de l'analyse pipeline (purement local,
 * pas d'appel API). Inclut uniquement les étapes ouvertes (closedWon /
 * closedLost ne sont pas comptées dans le funnel — elles représentent la
 * sortie du pipeline).
 */
export function buildPipelineConversion(pa: PipelineAnalytics): PipelineConversion {
  // Ordonner les stages par displayOrder pour avoir un funnel cohérent
  const orderedStages = [...pa.pipeline.stages].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  // Map stageId → dealCount (depuis PipelineAnalytics.stages qui filtre déjà
  // les étapes vides — on remplit à 0 pour les manquantes)
  const countByStage = new Map<string, number>();
  for (const s of pa.stages) countByStage.set(s.stage.id, s.dealCount);

  // reachedCount cumulatif depuis la fin
  const reachedFromEnd: number[] = new Array(orderedStages.length).fill(0);
  let cumul = 0;
  for (let i = orderedStages.length - 1; i >= 0; i--) {
    cumul += countByStage.get(orderedStages[i].id) ?? 0;
    reachedFromEnd[i] = cumul;
  }

  const stages: StageConversion[] = orderedStages.map((s, i) => {
    const inStage = countByStage.get(s.id) ?? 0;
    const reached = reachedFromEnd[i];
    const next = orderedStages[i + 1] ?? null;
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

  return { pipeline: pa.pipeline, stages, totalEntries, endToEndPct };
}
