"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WORKSPACE_COOKIE, type WorkspaceId } from "@/lib/workspaces";

const tabs = [
  { href: "/dashboard/parametres/general", label: "Général" },
  { href: "/dashboard/parametres/equipe", label: "Utilisateurs & équipes" },
  { href: "/dashboard/parametres/agents", label: "Agents" },
  { href: "/dashboard/parametres/enrichissement", label: "Enrichissement" },
  { href: "/dashboard/parametres/cohortes", label: "Cohortes" },
  { href: "/dashboard/parametres/integrations", label: "Intégrations" },
  { href: "/dashboard/parametres/modele-donnees", label: "Modèle de données" },
  { href: "/dashboard/parametres/notifications", label: "Notifications" },
  { href: "/dashboard/parametres/tour-de-controle", label: "Tour de contrôle" },
  { href: "/dashboard/parametres/securite-api", label: "Sécurité & API" },
];

/** Espace de travail courant (cookie) — "all" = espace global (admin). */
function currentWorkspace(): WorkspaceId {
  const m = document.cookie.match(new RegExp(`(?:^|; )${WORKSPACE_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : "all";
  return (["all", "sales", "marketing", "cs", "finance"].includes(v) ? v : "all") as WorkspaceId;
}

export function ParametresTabs() {
  const pathname = usePathname();
  // Onglets masqués par la matrice « Accès aux pages par équipe » (bloc
  // Paramètres, admin) : visualisation refusée pour l'espace courant → onglet
  // retiré. Sans règle enregistrée, tout reste visible (défaut historique).
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ws = currentWorkspace();
    if (ws === "all") return; // espace global : jamais filtré
    let alive = true;
    fetch("/api/page-access")
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((d: { rules?: Array<{ page_href: string; access: Record<string, Record<string, boolean>> | null }> }) => {
        if (!alive) return;
        const off = new Set<string>();
        for (const r of d.rules ?? []) {
          if (!r.page_href?.startsWith("/dashboard/parametres")) continue;
          if (r.access?.[ws]?.view === false) off.add(r.page_href);
        }
        setHidden(off);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1 overflow-x-auto">
        {tabs
          .filter((t) => !hidden.has(t.href))
          .map((t) => {
            const isActive = pathname === t.href || pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative shrink-0 px-4 py-2 text-sm font-medium transition ${
                  isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
                }`}
              >
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
