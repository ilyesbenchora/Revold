"use client";

import { useEffect, useState } from "react";

/**
 * CTA "Créer une table de données" présent dans les blocs de données des pages
 * de performance. Émet un CustomEvent que le builder de la page (PageDataTables)
 * écoute pour ouvrir le funnel sur les KPIs dynamiques de la page.
 *
 * Les props team/kpiId… sont conservées pour compatibilité des appelants mais
 * ne sont plus utilisées (le contexte est porté par la page).
 */

export type CreateAlertCtaProps = {
  team?: "sales" | "marketing" | "cs" | "revops";
  kpiId?: string;
  defaultThreshold?: number;
  defaultDirection?: "above" | "below";
  defaultUnit?: "percent" | "currency" | "count";
  defaultPipelineIds?: string[];
  label?: string;
};

export function CreateAlertCta({ label = "Créer une table de données" }: CreateAlertCtaProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(typeof window !== "undefined"); }, []);

  function fire() {
    if (!ready) return;
    // Ouvre le builder de « table de données » de la page (KPIs dynamiques selon
    // la page). Le contexte est porté par la page, pas par le bloc.
    window.dispatchEvent(new CustomEvent("revold:open-data-table"));
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
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </svg>
      {label}
    </button>
  );
}
