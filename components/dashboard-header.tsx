import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { BrandLogo } from "@/components/brand-logo";
import { AlertsDropdown } from "@/components/alerts-dropdown";
import { logoutAction } from "@/app/login/actions";

export type ConnectedBadge = {
  key: string;
  label: string;
  domain: string;
  icon: string;
};

type DashboardHeaderProps = {
  companyName: string;
  /** Liste des outils RÉELLEMENT connectés à Revold pour l'org courante.
   *  Chaque élément génère un petit badge cliquable avec logo. Vide → pas de
   *  badge affiché (le user voit juste son nom de boîte + cloche). */
  connectedTools?: ConnectedBadge[];
};

export function DashboardHeader({ companyName, connectedTools = [] }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-card-border bg-white px-4 md:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" aria-label="Vue d'ensemble" className="transition hover:opacity-80">
          <RevoldLogo />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {/* Badges des outils connectés — affichés UNIQUEMENT s'il y en a au moins un */}
        {connectedTools.length > 0 && (
          <Link
            href="/dashboard/integration"
            className="hidden items-center gap-1.5 rounded-full border border-card-border px-2 py-1.5 transition hover:bg-slate-50 md:flex"
            title={`${connectedTools.length} outil${connectedTools.length > 1 ? "s" : ""} connecté${connectedTools.length > 1 ? "s" : ""} : ${connectedTools.map((t) => t.label).join(", ")}`}
          >
            <div className="flex -space-x-1.5">
              {connectedTools.slice(0, 4).map((tool) => (
                <BrandLogo
                  key={tool.key}
                  domain={tool.domain}
                  alt={tool.label}
                  fallback={tool.icon}
                  size={20}
                  className="ring-2 ring-white"
                />
              ))}
            </div>
            {connectedTools.length > 4 && (
              <span className="text-[10px] font-medium text-slate-500">
                +{connectedTools.length - 4}
              </span>
            )}
            <span className="ml-1 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-600">
                {connectedTools.length} connecté{connectedTools.length > 1 ? "s" : ""}
              </span>
            </span>
          </Link>
        )}
        <span className="text-sm font-medium text-slate-600">{companyName}</span>
        <AlertsDropdown />
        <Link
          href="/dashboard/mon-compte"
          aria-label="Mon compte"
          title="Mon compte"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
