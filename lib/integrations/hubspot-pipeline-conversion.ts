/**
 * Calcule le taux de conversion étape par étape pour un pipeline HubSpot.
 *
 * Méthode :
 *   - Pour chaque étape S du pipeline, on demande à HubSpot le NOMBRE TOTAL
 *     de deals dont la propriété hs_date_entered_<stageId> existe (HAS_PROPERTY).
 *     C'est-à-dire : tous les deals qui sont passés au moins une fois par
 *     cette étape (qu'ils soient encore dans cette étape, plus loin, ou
 *     même fermés).
 *   - Le taux de conversion étape N → étape N+1 = entered(N+1) / entered(N).
 *
 * Les stages sont triés par displayOrder (ordre du pipeline HubSpot).
 */

import type { HsPipeline } from "./hubspot-pipelines";

const HS_API = "https://api.hubapi.com";

export type StageConversion = {
  stage: { id: string; label: string; displayOrder: number };
  enteredCount: number;
  // Conversion DE cette étape vers la suivante (null si dernière étape)
  conversionToNextPct: number | null;
  nextStageLabel: string | null;
};

export type PipelineConversion = {
  pipeline: HsPipeline;
  stages: StageConversion[];
  totalEntries: number;
  // Conversion globale entrée pipeline → dernière étape gagnée
  endToEndPct: number | null;
};

async function countDealsEnteredStage(
  token: string,
  pipelineId: string,
  stageId: string,
): Promise<number> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "pipeline", operator: "EQ", value: pipelineId },
              { propertyName: `hs_date_entered_${stageId}`, operator: "HAS_PROPERTY" },
            ],
          },
        ],
        limit: 1,
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.total === "number" ? data.total : 0;
  } catch {
    return 0;
  }
}

export async function fetchPipelineConversion(
  token: string,
  pipeline: HsPipeline,
): Promise<PipelineConversion> {
  const sortedStages = [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);

  const counts = await Promise.all(
    sortedStages.map((s) => countDealsEnteredStage(token, pipeline.id, s.id)),
  );

  const stages: StageConversion[] = sortedStages.map((s, i) => {
    const entered = counts[i];
    const next = sortedStages[i + 1];
    const nextEntered = next ? counts[i + 1] : null;
    const conversionToNextPct =
      next && entered > 0 && nextEntered !== null
        ? Math.round((nextEntered / entered) * 100)
        : null;
    return {
      stage: { id: s.id, label: s.label, displayOrder: s.displayOrder },
      enteredCount: entered,
      conversionToNextPct,
      nextStageLabel: next?.label ?? null,
    };
  });

  const totalEntries = counts[0] ?? 0;
  const lastEntries = counts[counts.length - 1] ?? 0;
  const endToEndPct =
    totalEntries > 0 ? Math.round((lastEntries / totalEntries) * 100) : null;

  return { pipeline, stages, totalEntries, endToEndPct };
}
