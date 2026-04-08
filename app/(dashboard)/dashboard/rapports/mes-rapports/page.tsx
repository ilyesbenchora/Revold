export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { RapportsTabs } from "@/components/rapports-tabs";
import Link from "next/link";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export default async function MesRapportsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsRecord>;
}) {
  const sp = (await searchParams) ?? {};
  const activatedReportId = typeof sp.activate === "string" ? sp.activate : null;
  const activatedReportTitle = typeof sp.title === "string" ? sp.title : null;

  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let singleCount = 0;
  let multiCount = 0;
  if (hubspotTokenConfigured) {
    try {
      const integrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!);
      singleCount = getReportSuggestions(integrations).length;
      multiCount = getCrossSourceReports(integrations).length;
    } catch {}
  }

  // Mes rapports = empty for now (no activations stored yet — the action
  // will be wired to a Supabase table in a future iteration)
  const activatedReports: Array<{ id: string; title: string }> = [];
  const myCount = activatedReports.length;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vos rapports activés et leurs résultats. Activez des rapports depuis les onglets
          « Intégration unique » et « Intégrations multiples » pour les retrouver ici.
        </p>
      </header>

      <RapportsTabs myCount={myCount} singleCount={singleCount} multiCount={multiCount} />

      {/* Confirmation banner après activation */}
      {activatedReportId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-900">
                Rapport en cours d&apos;activation
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {activatedReportTitle ? (
                  <>« <strong>{activatedReportTitle}</strong> » est en file d&apos;activation. </>
                ) : (
                  <>Votre rapport est en file d&apos;activation. </>
                )}
                Il apparaîtra ici dès que la première synchronisation des données nécessaires sera terminée.
              </p>
            </div>
          </div>
        </div>
      )}

      {activatedReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">
            Aucun rapport activé pour l&apos;instant
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Parcourez les rapports suggérés et activez ceux qui correspondent à vos besoins business.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/dashboard/rapports/integration-unique"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Intégration unique
            </Link>
            <Link
              href="/dashboard/rapports/integrations-multiples"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Intégrations multiples
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activatedReports.map((r) => (
            <article key={r.id} className="card p-5">
              <h3 className="text-base font-semibold text-slate-900">{r.title}</h3>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
