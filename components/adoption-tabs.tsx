"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdoptionTabs() {
  const pathname = usePathname();
  const tabs: Array<{ href: string; label: string; highlight?: boolean }> = [
    { href: "/dashboard/conduite-changement", label: "Vue d'ensemble" },
    { href: "/dashboard/conduite-changement/activites", label: "Équipes" },
    { href: "/dashboard/conduite-changement/assets", label: "Assets" },
    { href: "/dashboard/conduite-changement/connexions", label: "Suivi" },
    { href: "/dashboard/conduite-changement/recommandations", label: "Recommandations", highlight: true },
  ];

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link key={t.href} href={t.href}
              className={`relative px-4 py-2 text-sm font-medium transition ${isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"} ${t.highlight ? "flex items-center gap-1.5" : ""}`}>
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
