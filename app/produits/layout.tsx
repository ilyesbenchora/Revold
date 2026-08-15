import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

const PRODUCTS = [
  { label: "Synchronisation de données", href: "/produits/synchronisation" },
  { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
  { label: "Résolution d'entités", href: "/produits/resolution-entites" },
  { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
  { label: "Audit complet du CRM", href: "/produits/audit-crm" },
  { label: "Alertes, objectifs & actions", href: "/produits/alertes-previsions" },
];

export default function ProduitsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* Sub-nav produits */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
          {PRODUCTS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-fuchsia-300"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {children}

      <SiteFooter />
    </div>
  );
}
