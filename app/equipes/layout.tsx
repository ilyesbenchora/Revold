import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";


// Indexation resserrée : home + blog uniquement — section noindex.
export const metadata: Metadata = { robots: { index: false, follow: true } };

const TEAMS = [
  { label: "Direction / CEO", href: "/equipes/direction" },
  { label: "Marketing", href: "/equipes/marketing" },
  { label: "Sales", href: "/equipes/sales" },
  { label: "RevOps", href: "/equipes/revops" },
  { label: "CSM", href: "/equipes/csm" },
  { label: "Finance", href: "/equipes/finance" },
];

export default function EquipesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
          {TEAMS.map((t) => (
            <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-fuchsia-300">
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {children}

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
}
