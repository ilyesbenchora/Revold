import type { ReactNode } from "react";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

const PRODUCTS = [
  { label: "Synchronisation de données", href: "/produits/synchronisation" },
  { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
  { label: "Résolution d'entités", href: "/produits/resolution-entites" },
  { label: "Insights IA cross-source", href: "/produits/insights-ia" },
  { label: "Audit complet du CRM", href: "/produits/audit-crm" },
  { label: "Alertes & Prévisions de ventes", href: "/produits/alertes-previsions" },
];

export default function ProduitsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      {/* Sub-nav produits */}
      <div className="border-b border-card-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
          {PRODUCTS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-accent-soft hover:text-accent"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {children}

      {/* Footer */}
      <footer className="mt-auto border-t border-card-border bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <RevoldLogo />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/#solutions" className="hover:text-slate-900">Produit</Link>
            <Link href="/#pricing" className="hover:text-slate-900">Tarifs</Link>
            <Link href="/login" className="hover:text-slate-900">Connexion</Link>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
