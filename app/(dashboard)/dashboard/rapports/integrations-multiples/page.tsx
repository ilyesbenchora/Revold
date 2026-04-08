export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { RapportsTabs } from "@/components/rapports-tabs";
import Link from "next/link";

export default async function RapportsIntegrationsMultiplesPage() {
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let crossReports: ReturnType<typeof getCrossSourceReports> = [];
  let detectedCount = 0;
  let singleCount = 0;

  if (hubspotTokenConfigured) {
    try {
      const integrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!);
      detectedCount = integrations.length;
      singleCount = getReportSuggestions(integrations).length;
      crossReports = getCrossSourceReports(integrations);
    } catch {}
  }

  const totalReports = crossReports.length;
  const highPriorityCount = crossReports.filter((r) => r.priority === "high").length;
  const distinctCategories = new Set<string>();
  crossReports.forEach((r) => r.requiredCategories.forEach((c) => distinctCategories.add(c)));

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports cross-sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports qui croisent <strong>plusieurs outils métiers</strong> (CRM × facturation × prospection × support…)
          pour faire ressortir les insights impossibles à générer avec un seul outil.
        </p>
      </header>

      <RapportsTabs singleCount={singleCount} multiCount={totalReports} />

      {/* KPI overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils détectés</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{detectedCount}</p>
          <p className="mt-1 text-xs text-slate-400">Sources connectées au CRM</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Rapports croisés</p>
          <p className="mt-1 text-3xl font-bold text-fuchsia-600">{totalReports}</p>
          <p className="mt-1 text-xs text-slate-400">Activables sur votre stack</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Haute valeur</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{highPriorityCount}</p>
          <p className="mt-1 text-xs text-slate-400">Impact direct sur le CA</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Catégories impliquées</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{distinctCategories.size}</p>
          <p className="mt-1 text-xs text-slate-400">CRM, billing, support…</p>
        </article>
      </div>

      {totalReports === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun rapport croisé activable pour l&apos;instant. Connectez au moins
            <strong> 2 outils métiers de catégories différentes</strong> (un CRM + un billing par exemple)
            pour débloquer les rapports cross-sources.
          </p>
          <Link
            href="/dashboard/integration"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
          >
            Voir les intégrations à connecter →
          </Link>
        </div>
      ) : (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
              Rapports cross-sources
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                {totalReports} rapport{totalReports > 1 ? "s" : ""}
              </span>
              <span className="ml-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                🔗 Multi-sources
              </span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Chaque rapport ci-dessous nécessite plusieurs outils connectés simultanément. C&apos;est exactement
            ce qu&apos;aucun outil seul ne peut produire — la valeur unique de Revold.
          </p>
          <div className="space-y-3">
            {crossReports.map((report) => (
              <article
                key={report.id}
                className={`card p-5 ${
                  report.priority === "high" ? "border-l-4 border-l-fuchsia-500" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{report.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900">{report.title}</h3>
                      {report.priority === "high" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          Haute valeur
                        </span>
                      )}
                      {report.priority === "medium" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          Valeur moyenne
                        </span>
                      )}
                      <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                        🔗 {report.requiredCategories.length || "Tous"} outils
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{report.description}</p>

                    {report.requiredCategories.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Catégories nécessaires :</span>
                        {report.requiredCategories.map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        KPIs du rapport
                      </p>
                      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {report.metrics.map((m) => (
                          <li key={m} className="flex items-start gap-1.5 text-xs text-slate-700">
                            <span className="mt-0.5 text-fuchsia-500">✓</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="mt-3 text-xs text-fuchsia-700">
                      <span className="font-semibold">Impact attendu :</span> {report.expectedValue}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                    disabled
                    title="Bientôt disponible"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Activer ce rapport croisé
                  </button>
                </div>
              </article>
            ))}
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}
