"use client";

import { usePathname } from "next/navigation";

const HEADERS: Record<string, { title: string; sub: string }> = {
  "/dashboard/insights-ia/commercial": {
    title: "Coaching Ventes à faire",
    sub: "Les actions de coaching commerciales à mener : deals, pipeline, closing, workflows.",
  },
  "/dashboard/insights-ia/marketing": {
    title: "Coaching Marketing à faire",
    sub: "Les actions de coaching acquisition à mener : leads, conversion, sources.",
  },
  "/dashboard/insights-ia/data": {
    title: "Coaching Data à faire",
    sub: "Les actions à mener pour fiabiliser ta donnée : complétude, doublons, enrichissement.",
  },
  "/dashboard/insights-ia/integration": {
    title: "Coaching Intégration à faire",
    sub: "Les actions pour mieux exploiter et connecter ta stack d'outils.",
  },
  "/dashboard/insights-ia/cross-source": {
    title: "Coaching Cross-Source à faire",
    sub: "Les actions issues du croisement de tes sources (CRM × facturation × support).",
  },
  "/dashboard/insights-ia/data-model": {
    title: "Coaching Finance à faire",
    sub: "Les actions pour piloter ta trésorerie et ta comptabilité : cash, échéances, marges.",
  },
};

const DEFAULT = {
  title: "Coaching IA",
  sub: "Tes coachs experts par catégorie. Choisis un coach, fixe tes objectifs et suis tes actions.",
};

export function CoachingHeader() {
  const pathname = usePathname();
  const h = HEADERS[pathname] ?? DEFAULT;
  return (
    <header>
      <h1 className="text-2xl font-semibold text-slate-900">{h.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{h.sub}</p>
    </header>
  );
}
