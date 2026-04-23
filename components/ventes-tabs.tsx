"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function VentesTabs() {
  const pathname = usePathname();
  const tabs: Array<{ href: string; label: string }> = [
    { href: "/dashboard/performances/commerciale", label: "Vue d'ensemble" },
    { href: "/dashboard/performances/commerciale/deals-a-risque", label: "Deals à risque" },
    { href: "/dashboard/performances/commerciale/forecast-management", label: "Forecast Management" },
  ];

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative px-4 py-2 text-sm font-medium transition ${
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
