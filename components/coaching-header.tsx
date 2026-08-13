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
    title: "Coaching Data & Intégrations à faire",
    sub: "Les actions pour fiabiliser ta donnée et ta stack d'outils : complétude, doublons, enrichissement, connexions.",
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

// Vue d'ensemble (« Mes Coachs IA ») : pas de nom de page — la promesse fait
// office de titre, suivie d'une phrase d'accompagnement.
const DEFAULT = {
  title: "Tes coachs experts par catégorie. Choisis un coach, fixe tes objectifs et suis tes actions",
  sub: "Chaque coach s'appuie sur tes données réelles : il prépare tes séances, te challenge sur tes objectifs et transforme chaque décision en actions suivies.",
};

export function CoachingHeader() {
  const pathname = usePathname();
  const h = HEADERS[pathname] ?? DEFAULT;
  const isOverview = !HEADERS[pathname];
  return (
    <header>
      <h1 className={`font-semibold text-slate-900 ${isOverview ? "max-w-3xl text-xl leading-snug" : "text-2xl"}`}>{h.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{h.sub}</p>
    </header>
  );
}
