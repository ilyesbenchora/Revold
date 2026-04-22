"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs: Array<{ href: string; label: string; highlight?: boolean }> = [
  { href: "/dashboard/audit/service-client", label: "Vue d'ensemble" },
  { href: "/dashboard/audit/service-client/process", label: "Process" },
  { href: "/dashboard/audit/service-client/churn", label: "Churn" },
  { href: "/dashboard/audit/service-client/cross-sell-upsell", label: "Cross-sell / Upsell" },
  { href: "/dashboard/audit/service-client/renouvellement", label: "Renouvellement" },
  { href: "/dashboard/audit/service-client/recommandations", label: "Recommandations", highlight: true },
];

export function ServiceClientTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
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
