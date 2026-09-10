"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Rangée « équipe d'experts IA + tour de contrôle » de la home — DYNAMIQUE :
 * quand la tour ouvre son panneau « à traiter » (brief du jour), le bloc
 * agents se RÉDUIT (2/3 → 1/3) et la carte de la tour s'élargit — l'orbe se
 * décale à gauche et le panneau s'affiche en grand à sa droite, sans jamais
 * se chevaucher. Signal : événement window `revold:tower-panel` émis par l'orbe.
 */
export function HomeTowerRow({ agents, tower }: { agents: ReactNode; tower: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onPanel = (e: Event) => setExpanded(Boolean((e as CustomEvent).detail?.open));
    window.addEventListener("revold:tower-panel", onPanel);
    return () => window.removeEventListener("revold:tower-panel", onPanel);
  }, []);

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
      <div className={`min-w-0 transition-all ${expanded ? "xl:col-span-1" : "xl:col-span-2"}`}>{agents}</div>
      <div className={`min-w-0 transition-all ${expanded ? "xl:col-span-2" : "xl:col-span-1"}`}>{tower}</div>
    </div>
  );
}
