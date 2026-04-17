import type { ReactNode } from "react";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      <div className="border-b border-card-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
          {TEAMS.map((t) => (
            <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-accent-soft hover:text-accent">
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {children}

      <footer className="mt-auto border-t border-card-border bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <RevoldLogo />
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
