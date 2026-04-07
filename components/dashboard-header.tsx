import { RevoldLogo } from "@/components/revold-logo";
import { logoutAction } from "@/app/login/actions";

type DashboardHeaderProps = {
  companyName: string;
  globalScore?: number;
  integrationScore?: number;
};

function getScoreLabel(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700" };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function DashboardHeader({ companyName, globalScore, integrationScore }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-card-border bg-white px-4 md:px-6">
      <div className="flex items-center gap-6">
        <RevoldLogo />
        {globalScore != null && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-xs text-slate-500">Score global</span>
            <span className={`text-lg font-bold ${getScoreColor(globalScore)}`}>
              {globalScore}<span className="text-xs font-normal text-slate-400">/100</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreLabel(globalScore).className}`}>
              {getScoreLabel(globalScore).label}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {integrationScore != null && (
          <div className="hidden items-center gap-2 rounded-lg border border-card-border px-3 py-1.5 md:flex">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
            <span className="text-xs text-slate-500">Intégration</span>
            <span className={`text-sm font-bold ${getScoreColor(integrationScore)}`}>
              {integrationScore}%
            </span>
          </div>
        )}
        <span className="text-sm font-medium text-slate-600">{companyName}</span>
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
