"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type CategoryCount = {
  commercial: number;
  marketing: number;
  data: number;
  integration: number;
  crossSource: number;
  dataModel: number;
};

type Props = {
  counts: CategoryCount;
};

export function CoachingTabs({ counts }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/insights-ia", label: "Mes coaching IA", count: null },
    { href: "/dashboard/insights-ia/commercial", label: "Commercial", count: counts.commercial },
    { href: "/dashboard/insights-ia/marketing", label: "Marketing", count: counts.marketing },
    { href: "/dashboard/insights-ia/data", label: "Data", count: counts.data },
    { href: "/dashboard/insights-ia/integration", label: "Intégration", count: counts.integration },
    { href: "/dashboard/insights-ia/cross-source", label: "Cross-Source", count: counts.crossSource },
    { href: "/dashboard/insights-ia/data-model", label: "Modèle de données", count: counts.dataModel },
  ];

  return (
    <div className="border-b border-card-border overflow-x-auto">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? "text-accent" : "text-slate-400"}`}>
                  {t.count}
                </span>
              )}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
