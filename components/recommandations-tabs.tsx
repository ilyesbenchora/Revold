"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  counts?: { donnees?: number; process?: number; performances?: number; adoption?: number };
};

export function RecommandationsTabs({ counts = {} }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/audit/recommandations", label: "Vue d'ensemble", emoji: "🎯", count: undefined },
    { href: "/dashboard/audit/recommandations/donnees", label: "Données", emoji: "🗂️", count: counts.donnees },
    { href: "/dashboard/audit/recommandations/process", label: "Process & Alignement", emoji: "⚙️", count: counts.process },
    { href: "/dashboard/audit/recommandations/performances", label: "Performances", emoji: "📈", count: counts.performances },
    { href: "/dashboard/audit/recommandations/adoption", label: "Adoption", emoji: "🚀", count: counts.adoption },
  ];

  return (
    <div className="border-b border-card-border overflow-x-auto">
      <div className="flex gap-1 min-w-fit">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-accent text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
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
