"use client";

/**
 * Hook partagé « Vérification du câblage » (création ET édition d'alertes /
 * objectifs) — même mécanique que le funnel des tables de données :
 *  - câblage existant (forecast_type / recon_recipe / agg_spec) → ré-évaluation
 *    DÉTERMINISTE via /api/tracking/preview (valeur actuelle réelle) ;
 *  - KPI libre ou titre modifié → l'agent propose un nouveau câblage ;
 *  - `entity` (imposer une source) → re-câblage agent contraint ;
 *  - `adjustedSpec` (mesure/champ corrigés) → ré-évaluation déterministe.
 * Rien n'est créé ni modifié tant que l'utilisateur n'a pas validé.
 */

import { useState } from "react";
import type { TrackingProposal } from "@/components/tracking-verification";

export type WiringPreviewInput = {
  kpiText: string;
  team?: string | null;
  unit?: string | null;
  description?: string | null;
  /** Câblage existant à ré-évaluer tel quel (édition sans changement de KPI). */
  forecastType?: string | null;
  reconRecipe?: string | null;
  aggSpec?: Record<string, unknown> | null;
  /** Re-câblage contraint sur une entité (« Imposer une autre source »). */
  entity?: string;
  /** Spec corrigée manuellement (sélecteur Mesure) — déterministe. */
  adjustedSpec?: Record<string, unknown>;
};

export function useWiringPreview() {
  const [proposal, setProposal] = useState<TrackingProposal | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [verifying, setVerifying] = useState(false);

  async function requestPreview(input: WiringPreviewInput): Promise<boolean> {
    if (verifying) return false;
    setVerifying(true);
    try {
      const body: Record<string, unknown> = {
        kpi_text: input.kpiText,
        team: input.team ?? undefined,
        category: input.team ?? undefined,
        unit: input.unit ?? undefined,
        description: input.description || undefined,
      };
      if (input.adjustedSpec) body.agg_spec = input.adjustedSpec;
      else if (input.entity) body.entity = input.entity;
      else if (input.forecastType) body.forecast_type = input.forecastType;
      else if (input.reconRecipe) body.recon_recipe = input.reconRecipe;
      else if (input.aggSpec) body.agg_spec = input.aggSpec;

      const res = await fetch("/api/tracking/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (d.counts) setCounts(d.counts);
      if (res.ok && d.resolution) {
        setProposal(d.resolution as TrackingProposal);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setVerifying(false);
    }
  }

  function resetProposal() {
    setProposal(null);
  }

  return { proposal, counts, verifying, requestPreview, resetProposal };
}
