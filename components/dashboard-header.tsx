import { RevoldLogo } from "@/components/revold-logo";
import { logoutAction } from "@/app/login/actions";

type DashboardHeaderProps = {
  companyName: string;
};

export function DashboardHeader({ companyName }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-card-border bg-white px-4 md:px-6">
      <RevoldLogo />
      <div className="flex items-center gap-4">
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
