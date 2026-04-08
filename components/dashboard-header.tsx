import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { AlertsDropdown } from "@/components/alerts-dropdown";
import { logoutAction } from "@/app/login/actions";
import { getScoreLabel, getScoreTextColor } from "@/lib/score-utils";

type DashboardHeaderProps = {
  companyName: string;
  integrationScore?: number;
};

export function DashboardHeader({ companyName, integrationScore }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-card-border bg-white px-4 md:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" aria-label="Vue d'ensemble" className="transition hover:opacity-80">
          <RevoldLogo />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {integrationScore != null && (
          <Link
            href="/dashboard/integration"
            className="hidden items-center gap-2 rounded-lg border border-card-border px-3 py-1.5 transition hover:bg-slate-50 md:flex"
            title="Score d'intégration HubSpot"
          >
            {/* HubSpot logo */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FF7A59">
              <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978v-.067A2.2 2.2 0 0 0 17.238.845h-.067a2.2 2.2 0 0 0-2.193 2.194v.067a2.198 2.198 0 0 0 1.267 1.978V7.93a6.215 6.215 0 0 0-2.952 1.3L5.51 3.146a2.476 2.476 0 1 0-1.16 1.578l7.658 5.96a6.235 6.235 0 0 0 .094 7.027l-2.33 2.33a2.013 2.013 0 0 0-.581-.093 2.04 2.04 0 1 0 2.04 2.04 2.013 2.013 0 0 0-.094-.581l2.305-2.305a6.247 6.247 0 1 0 4.722-11.173zm-1.106 9.371a3.205 3.205 0 1 1 3.205-3.205 3.208 3.208 0 0 1-3.205 3.205z"/>
            </svg>
            <span className="text-xs text-slate-500">Score HubSpot</span>
            <span className={`text-sm font-bold ${getScoreTextColor(integrationScore)}`}>
              {integrationScore}<span className="text-xs font-normal text-slate-400">/100</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getScoreLabel(integrationScore).className}`}>
              {getScoreLabel(integrationScore).label}
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
