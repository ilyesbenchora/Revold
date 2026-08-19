"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WORKSPACE_COOKIE, type WorkspaceId } from "@/lib/workspaces";

// Premier rang : les SECTIONS uniquement — leurs sous-pages (Cycle de ventes,
// Publicité, pages custom…) vivent dans la deuxième rangée d'onglets
// personnalisable de chaque section (VentesTabs / MarketingTabs).
const tabs: Array<{ href: string; label: string; highlight?: boolean }> = [
  { href: "/dashboard/performances/commerciale", label: "Ventes" },
  { href: "/dashboard/performances/marketing", label: "Marketing" },
];

/**
 * Onglets filtrés par ESPACE DE TRAVAIL (même source que la sidebar : cookie
 * puis localStorage) : l'espace Ventes ne voit que l'onglet Ventes ;
 * Marketing ne voit que Marketing ; l'espace global voit tout.
 */
function visibleTabs(ws: WorkspaceId) {
  if (ws === "sales") return tabs.filter((t) => t.href === "/dashboard/performances/commerciale");
  if (ws === "marketing") return tabs.filter((t) => t.href !== "/dashboard/performances/commerciale");
  return tabs;
}

export function PerformancesTabs() {
  const pathname = usePathname();
  const [ws, setWs] = useState<WorkspaceId>("all");
  useEffect(() => {
    try {
      const fromCookie = document.cookie.match(new RegExp(`(?:^|; )${WORKSPACE_COOKIE}=([^;]*)`))?.[1] as
        | WorkspaceId
        | undefined;
      const saved = fromCookie ?? (localStorage.getItem("revold:workspace") as WorkspaceId | null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setWs(saved);
    } catch {
      /* cookie/stockage indisponible → tous les onglets */
    }
  }, []);

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {visibleTabs(ws).map((t) => {
          // La section reste active sur toutes ses sous-pages (Publicité,
          // pages custom /p/[slug]…) — la 2e rangée précise laquelle.
          const isActive = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              } ${t.highlight ? "flex items-center gap-1.5" : ""}`}
            >
              {t.highlight && <span aria-hidden>✨</span>}
              {t.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
