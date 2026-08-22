import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";


// Sections INDEXÉES (longue traîne) — chaque page porte son titre/description.
export const metadata: Metadata = { robots: { index: true, follow: true } };

const SOLUTIONS = [
  { label: "Optimiser les revenus", href: "/solutions/optimiser-revenus" },
  { label: "Fiabiliser les données", href: "/solutions/fiabiliser-donnees" },
  { label: "Accélérer les cycles de vente", href: "/solutions/accelerer-cycles-vente" },
  { label: "Piloter la performance", href: "/solutions/piloter-performance" },
  { label: "Unifier le stack", href: "/solutions/unifier-stack" },
  { label: "Réduire le churn", href: "/solutions/reduire-churn" },
];

export default function SolutionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
          {SOLUTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-fuchsia-300"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {children}

      <SiteFooter />
    </div>
  );
}
