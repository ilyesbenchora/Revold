"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Compteurs d'activité d'un agent, lus depuis l'historique local des
 * conversations (`revold:agent:{agentKey}:v1`, même source que le compteur de
 * discussions). Pour chaque agent : discussions, suggestions (analyses/rapports
 * produits), alertes proposées et actions proposées.
 *
 * Chaque compteur est cliquable et ouvre l'onglet correspondant de l'agent
 * (`?tab=history|suggestions|alerts|actions`). Les compteurs vivant à l'intérieur
 * de la carte-lien de l'agent, on stoppe la propagation pour ouvrir le bon onglet.
 */

type Counts = { discussions: number; suggestions: number; alerts: number; actions: number };
const ZERO: Counts = { discussions: 0, suggestions: 0, alerts: 0, actions: 0 };

function readCounts(agentKey: string): Counts {
  try {
    const raw = localStorage.getItem(`revold:agent:${agentKey}:v1`);
    const convs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(convs)) return ZERO;
    let suggestions = 0;
    let alerts = 0;
    let actions = 0;
    for (const conv of convs) {
      const msgs = Array.isArray(conv?.messages) ? conv.messages : [];
      for (const m of msgs) {
        if (m?.role !== "assistant") continue;
        if (m.report || m.chart) suggestions++; // analyse / rapport = suggestion d'insight
        if (m.action) alerts++; // suggestion d'alerte
        if (m.dealAction) actions++; // action pipeline proposée
      }
    }
    return { discussions: convs.length, suggestions, alerts, actions };
  } catch {
    return ZERO;
  }
}

// key = champ du compteur · tab = onglet cible de l'agent · icon = svg inline.
const ITEMS: { key: keyof Counts; label: string; tab: string; icon: React.ReactNode }[] = [
  {
    key: "discussions",
    label: "discussions",
    tab: "history",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    key: "suggestions",
    label: "suggestions",
    tab: "suggestions",
    icon: (
      <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </>
    ),
  },
  {
    key: "alerts",
    label: "alertes",
    tab: "alerts",
    icon: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
  },
  {
    key: "actions",
    label: "actions",
    tab: "actions",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
];

export function AgentInsightsCounts({ agentKey }: { agentKey: string }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    setCounts(readCounts(agentKey));
  }, [agentKey]);

  function open(e: React.SyntheticEvent, tab: string) {
    // La carte parente est un <Link> : on bloque sa navigation pour ouvrir l'onglet.
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/agents/${agentKey}?tab=${tab}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ITEMS.map((it) => (
        <span
          key={it.key}
          role="button"
          tabIndex={0}
          title={`Voir les ${it.label}`}
          onClick={(e) => open(e, it.tab)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(e, it.tab); }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-white hover:text-accent hover:ring-1 hover:ring-accent/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {it.icon}
          </svg>
          {counts === null ? "…" : counts[it.key]} {it.label}
        </span>
      ))}
    </div>
  );
}
