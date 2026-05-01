"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/parametres/general", label: "Général" },
  { href: "/dashboard/parametres/equipe", label: "Équipe" },
  { href: "/dashboard/parametres/billing", label: "Facturation" },
  { href: "/dashboard/parametres/integrations", label: "Intégrations" },
  { href: "/dashboard/parametres/modele-donnees", label: "Modèle de données" },
  { href: "/dashboard/parametres/notifications", label: "Notifications" },
  { href: "/dashboard/parametres/securite-api", label: "Sécurité & API" },
];

export function ParametresTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
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
