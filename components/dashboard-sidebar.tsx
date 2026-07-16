"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  WORKSPACES,
  availableWorkspaces,
  workspaceDef,
  isGroupVisible,
  isChildVisible,
  isLeafVisible,
  type WorkspaceId,
} from "@/lib/workspaces";

type LeafLink = { href: string; label: string; icon: React.ReactNode; ai?: boolean };
type GroupLink = { id: string; label: string; icon: React.ReactNode; children: LeafLink[]; ai?: boolean };
type SidebarItem = LeafLink | GroupLink;

/** Hover background gradient for AI pages (Coaching IA / Simulations IA).
 *  Discreet gold->fuchsia tones, en harmonie avec le bouton Upgrade.        */
const AI_HOVER_GRADIENT =
  "hover:bg-gradient-to-r hover:from-amber-100/70 hover:via-fuchsia-100/70 hover:to-amber-100/70";

function isGroup(item: SidebarItem): item is GroupLink {
  return "children" in item;
}

const auditChildren: LeafLink[] = [
  {
    href: "/dashboard/audit",
    label: "Vue d’ensemble",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/performances",
    label: "Performances",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/process",
    label: "Automatisations",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" /><path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" /><path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit/paiement-facturation",
    label: "Paiement & Facturation",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit/service-client",
    label: "Service Client",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z" />
        <path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/conduite-changement",
    label: "Équipes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/dashboard/donnees",
    label: "Propriétés",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
];

const coachingChildren: LeafLink[] = [
  {
    href: "/dashboard/insights-ia",
    label: "Vue d’ensemble",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/insights-ia/commercial",
    label: "Ventes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href: "/dashboard/insights-ia/marketing",
    label: "Marketing",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/insights-ia/data",
    label: "Data",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/insights-ia/integration",
    label: "Intégration",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/insights-ia/data-model",
    label: "Modèles de données",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
];

const dashboardChildren: LeafLink[] = [
  {
    href: "/dashboard/reporting",
    label: "Vue d’ensemble",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/mes-rapports",
    label: "Mes rapports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v4H4z" />
        <path d="M4 12h10v8H4z" />
        <path d="M18 12h2v8h-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/mes-alertes",
    label: "Mes alertes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

const previsionsChildren: LeafLink[] = [
  {
    href: "/dashboard/simulations",
    label: "Vue d’ensemble",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/simulations/mes-previsions",
    label: "Mes prévisions",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
    ),
  },
];

const integrationsChildren: LeafLink[] = [
  {
    href: "/dashboard/integration/mes-outils",
    label: "Mes outils connectés",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    ),
  },
  {
    href: "/dashboard/integration/bibliotheque",
    label: "Bibliothèque d’outils",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
    ),
  },
  {
    href: "/dashboard/integration/import-fichier",
    label: "Import de données",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
    ),
  },
  {
    href: "/dashboard/integration/mcp",
    label: "Serveurs MCP",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M14 7h3a2 2 0 0 1 2 2v3" /><path d="M10 17H7a2 2 0 0 1-2-2v-3" /></svg>
    ),
  },
];

const sidebarLinks: SidebarItem[] = [
  {
    href: "/dashboard",
    label: "Vue d’ensemble",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Données",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    children: auditChildren,
  },
  {
    id: "coaching",
    label: "Coaching IA",
    ai: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
      </svg>
    ),
    children: coachingChildren,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="10" y1="9" x2="12" y2="9" />
      </svg>
    ),
    children: dashboardChildren,
  },
  {
    id: "previsions",
    label: "Prévisions",
    ai: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    children: previsionsChildren,
  },
  {
    id: "integrations",
    label: "Intégrations",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
      </svg>
    ),
    children: integrationsChildren,
  },
  {
    href: "/dashboard/parametres",
    label: "Paramètres",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const accountLink = {
  href: "/dashboard/mon-compte",
  label: "Mon compte",
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

function isChildActive(pathname: string, href: string): boolean {
  // "Vue d’ensemble" entries must match exactly so they don't light up on sub-pages
  if (href === "/dashboard/audit") return pathname === "/dashboard/audit";
  if (href === "/dashboard/insights-ia") return pathname === "/dashboard/insights-ia";
  if (href === "/dashboard/simulations") return pathname === "/dashboard/simulations";
  return pathname.startsWith(href);
}

export function DashboardSidebar({ role = null, pole = null }: { role?: string | null; pole?: string | null }) {
  const pathname = usePathname();
  const isAccountActive = pathname.startsWith(accountLink.href);

  // Espaces de travail accessibles (POC) : admin → tous ; membre → le sien.
  const available = availableWorkspaces(role, pole);
  const [ws, setWs] = useState<WorkspaceId>(available[0]);

  // Hydratation : l'admin retrouve son dernier espace choisi ; le membre reste
  // verrouillé sur le sien.
  useEffect(() => {
    if (available.length <= 1) return;
    try {
      const saved = localStorage.getItem("revold:workspace") as WorkspaceId | null;
      if (saved && available.includes(saved)) setWs(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickWorkspace(id: WorkspaceId) {
    setWs(id);
    try {
      localStorage.setItem("revold:workspace", id);
    } catch {
      /* ignore */
    }
  }

  const canSwitch = available.length > 1;
  const activeWs = workspaceDef(ws);

  // Filtre la navigation selon l'espace actif.
  const visibleLinks = sidebarLinks.filter((item) =>
    isGroup(item) ? isGroupVisible(ws, item.id) : isLeafVisible(ws, item.href),
  );

  // Sidebar réduite : icônes uniquement. Au survol, un menu volant affiche le
  // libellé (liens simples) ou les sous-pages (groupes). Gain d'espace maximal.
  return (
    <aside className="sticky top-16 z-30 hidden h-[calc(100vh-4rem)] w-16 flex-col self-start border-r border-card-border bg-white py-4 md:flex">
      {/* Switcher d'espace de travail (POC) */}
      <div className="mb-2 border-b border-card-border px-2 pb-3">
        <div className="group relative">
          <button
            type="button"
            aria-label={`Espace : ${activeWs.label}`}
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-lg transition hover:bg-slate-50"
          >
            <span>{activeWs.icon}</span>
          </button>
          {/* Flyout : liste des espaces (ou libellé seul si verrouillé) */}
          <div className="invisible absolute left-full top-0 z-50 ml-1 min-w-56 rounded-xl border border-card-border bg-white p-1.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Espace de travail
            </p>
            {canSwitch ? (
              WORKSPACES.filter((w) => available.includes(w.id)).map((w) => {
                const active = w.id === ws;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => pickWorkspace(w.id)}
                    className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition ${
                      active ? "bg-accent-soft text-accent" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-base leading-none">{w.icon}</span>
                    <span className="min-w-0">
                      <span className="block">{w.label}</span>
                      <span className="block text-[10px] font-normal text-slate-400">{w.desc}</span>
                    </span>
                    {active && <span className="ml-auto text-[10px] text-accent">✓</span>}
                  </button>
                );
              })
            ) : (
              <div className="px-2.5 py-2">
                <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                  <span className="text-base">{activeWs.icon}</span> {activeWs.label}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Espace dédié à ton pôle.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {visibleLinks.map((item) => {
          if (isGroup(item)) {
            const children = item.children.filter((c) => isChildVisible(ws, item.id, c.href));
            if (children.length === 0) return null;
            const groupActive = children.some((c) => isChildActive(pathname, c.href));
            return (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  aria-label={item.label}
                  className={`flex w-full items-center justify-center rounded-lg p-2.5 transition ${
                    groupActive ? "bg-accent-soft text-accent" : `text-slate-500 ${item.ai ? AI_HOVER_GRADIENT : "hover:bg-slate-50"}`
                  }`}
                >
                  {item.icon}
                </button>
                {/* Menu volant : sous-pages */}
                <div className="invisible absolute left-full top-0 z-50 ml-1 min-w-52 rounded-xl border border-card-border bg-white p-1.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                  {children.map((child) => {
                    const active = isChildActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition ${
                          active ? "bg-accent-soft text-accent" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={active ? "text-accent" : "text-slate-400"}>{child.icon}</span>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                aria-label={item.label}
                className={`flex items-center justify-center rounded-lg p-2.5 transition ${
                  isActive ? "bg-accent-soft text-accent" : `text-slate-500 ${item.ai ? AI_HOVER_GRADIENT : "hover:bg-slate-50"}`
                }`}
              >
                {item.icon}
              </Link>
              {/* Tooltip volant : libellé */}
              <div className="invisible absolute left-full top-1/2 z-50 ml-1 -translate-y-1/2 whitespace-nowrap rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                {item.label}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Mon compte — épinglé en bas */}
      <div className="mt-4 border-t border-card-border px-2 pt-4">
        <div className="group relative">
          <Link
            href={accountLink.href}
            aria-label={accountLink.label}
            className={`flex items-center justify-center rounded-lg p-2.5 transition ${
              isAccountActive ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {accountLink.icon}
          </Link>
          <div className="invisible absolute bottom-0 left-full z-50 ml-1 whitespace-nowrap rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
            {accountLink.label}
          </div>
        </div>
      </div>
    </aside>
  );
}
