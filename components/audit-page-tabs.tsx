"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AuditTab = {
  href: string;
  label: string;
  /** Si true, la tab est mise en évidence (ex: badge "✨ IA"). */
  highlight?: boolean;
};

/**
 * Bandeau de tabs pour la navigation interne des pages audit.
 * Utilisable sur :
 *   - /dashboard/donnees           (Vue d'ensemble | Recommandations)
 *   - /dashboard/process           (Vue d'ensemble | Recommandations + workflows)
 *   - /dashboard/conduite-changement (Vue d'ensemble | Recommandations)
 *   - /dashboard/performances/...  (Vue d'ensemble | Recommandations)
 *   - /dashboard/audit/paiement-facturation (déjà a tabs, on ajoute Reco)
 *   - /dashboard/audit/service-client       (idem)
 */
export function AuditPageTabs({ tabs }: { tabs: AuditTab[] }) {
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
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
