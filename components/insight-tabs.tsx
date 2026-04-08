"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  doneCount?: number;
  removedCount?: number;
};

export function InsightTabs({ doneCount, removedCount }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/insights-ia", label: "Insights actifs" },
    {
      href: "/dashboard/insights-ia/realisees",
      label: doneCount != null ? `Insights réalisés (${doneCount})` : "Insights réalisés",
    },
    {
      href: "/dashboard/insights-ia/retirees",
      label: removedCount != null ? `Insights retirés (${removedCount})` : "Insights retirés",
    },
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
