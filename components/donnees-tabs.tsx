"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Onglet outil : une sous-page dédiée apparaît pour chaque outil connecté. */
export type DonneesToolTab = { key: string; label: string };

export function DonneesTabs({ toolTabs = [] }: { toolTabs?: DonneesToolTab[] }) {
  const pathname = usePathname();
  const tabs: Array<{ href: string; label: string; highlight?: boolean }> = [
    { href: "/dashboard/donnees", label: "Vue d'ensemble" },
    { href: "/dashboard/donnees/onboarding", label: "Audit onboarding", highlight: true },
    // Onglets dynamiques : un par outil connecté (HubSpot, Stripe, Pennylane…).
    ...toolTabs.map((t) => ({ href: `/dashboard/donnees/outils/${t.key}`, label: t.label })),
  ];

  return (
    <div className="border-b border-card-border">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
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
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
