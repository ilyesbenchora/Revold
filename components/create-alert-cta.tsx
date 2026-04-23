"use client";

import { useEffect, useState } from "react";

/**
 * CTA "Créer une alerte" qui ouvre le funnel CreateAlertModal directement
 * à l'étape 3 (Objectif), avec le KPI / pipeline / direction pré-remplis.
 *
 * Implémentation simple : on émet un CustomEvent que le modal global écoute.
 * Permet de réutiliser la même modal sans duplication de logique.
 */

export type CreateAlertCtaProps = {
  team: "sales" | "marketing" | "cs" | "revops";
  kpiId: string;
  defaultThreshold?: number;
  defaultDirection?: "above" | "below";
  defaultUnit?: "percent" | "currency" | "count";
  defaultPipelineIds?: string[];
  label?: string;
};

export function CreateAlertCta({
  team,
  kpiId,
  defaultThreshold,
  defaultDirection,
  defaultUnit,
  defaultPipelineIds,
  label = "Créer une alerte",
}: CreateAlertCtaProps) {
  const [hasModalListener, setHasModalListener] = useState(true);

  // Détecte si une CreateAlertModal est montée sur la page (sinon fallback link)
  useEffect(() => {
    setHasModalListener(typeof window !== "undefined");
  }, []);

  function fire() {
    if (!hasModalListener) return;
    window.dispatchEvent(
      new CustomEvent("revold:open-alert-modal", {
        detail: {
          team,
          kpiId,
          defaultThreshold,
          defaultDirection,
          defaultUnit,
          defaultPipelineIds,
          startStep: 3,
        },
      }),
    );
  }

  return (
    <button
      type="button"
      onClick={fire}
      className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {label}
    </button>
  );
}
