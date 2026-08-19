"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Onglets de la section Dashboard : « Vue d'ensemble » = la page des rapports
 * (anciennement « Mes rapports »), puis les tableaux de bord personnalisables.
 * L'accueil /dashboard a sa propre entrée dans la sidebar — plus d'onglet ici.
 */
const tabs = [
  { href: "/dashboard/mes-rapports", label: "Vue d'ensemble" },
  { href: "/dashboard/tableaux-de-bord", label: "Tableaux de bord" },
];

export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative shrink-0 px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
