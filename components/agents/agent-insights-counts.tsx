"use client";

import { useEffect, useState } from "react";

/**
 * Compteurs d'activité d'un agent, lus depuis l'historique local des
 * conversations (`revold:agent:{agentKey}:v1`, même source que le compteur de
 * discussions). Pour chaque agent : discussions, suggestions (analyses/rapports
 * produits), alertes proposées et actions proposées.
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

const ITEMS: { key: keyof Counts; label: string; icon: React.ReactNode }[] = [
  {
    key: "discussions",
    label: "discussions",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    key: "suggestions",
    label: "suggestions",
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
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
];

export function AgentInsightsCounts({ agentKey }: { agentKey: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    setCounts(readCounts(agentKey));
  }, [agentKey]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {ITEMS.map((it) => (
        <span
          key={it.key}
          title={it.label}
          className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-600"
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
