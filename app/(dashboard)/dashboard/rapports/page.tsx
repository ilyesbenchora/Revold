export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import {
  getReportSuggestions,
  getCategoryLabel,
  type ReportSuggestion,
} from "@/lib/reports/report-suggestions";
import { CollapsibleBlock } from "@/components/collapsible-block";
import Link from "next/link";

export default async function RapportsPage() {
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let suggestions: ReportSuggestion[] = [];
  let detectedCount = 0;

  if (hubspotTokenConfigured) {
    try {
      const integrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!);
      detectedCount = integrations.length;
      suggestions = getReportSuggestions(integrations);
    } catch {}
  }

  // Group by category for display
  const byCategory = new Map<string, ReportSuggestion[]>();
  for (const s of suggestions) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }

  const totalReports = suggestions.length;
  const highPriorityCount = suggestions.filter((s) => s.priority === "high").length;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports suggérés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revold croise les sources connectées à votre CRM pour vous proposer les rapports qui apportent
          le plus d&apos;opportunités et de chiffre d&apos;affaires. Plus vous connectez d&apos;outils, plus l&apos;analyse devient riche.
        </p>
      </header>

      {/* KPI overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils détectés</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{detectedCount}</p>
          <p className="mt-1 text-xs text-slate-400">Sources alimentant Revold</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Rapports disponibles</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalReports}</p>
          <p className="mt-1 text-xs text-slate-400">Croisements activables</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Haute valeur</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{highPriorityCount}</p>
          <p className="mt-1 text-xs text-slate-400">Impact direct sur le CA</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Catégories</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{byCategory.size}</p>
          <p className="mt-1 text-xs text-slate-400">Domaines couverts</p>
        </article>
      </div>

      {totalReports === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun rapport suggéré pour l&apos;instant. Connectez plus d&apos;outils métiers à HubSpot
            pour débloquer des rapports personnalisés.
          </p>
          <Link
            href="/dashboard/integration"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
          >
            Voir les intégrations à connecter →
          </Link>
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([category, reports]) => (
          <CollapsibleBlock
            key={category}
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                {getCategoryLabel(category as Parameters<typeof getCategoryLabel>[0])}
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {reports.length} rapport{reports.length > 1 ? "s" : ""}
                </span>
              </h2>
            }
          >
            <div className="space-y-3">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className={`card p-5 ${
                    report.priority === "high" ? "border-l-4 border-l-emerald-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
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
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{report.description}</p>

                        {/* Source integrations */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">Sources :</span>
                          {report.sourceIntegrations.map((src) => (
                            <span
                              key={src.key}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              <span>{src.icon}</span>
                              {src.label}
                            </span>
                          ))}
                        </div>

                        {/* Metrics */}
                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            KPIs du rapport
                          </p>
                          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {report.metrics.map((m) => (
                              <li key={m} className="flex items-start gap-1.5 text-xs text-slate-700">
                                <span className="mt-0.5 text-emerald-500">✓</span>
                                {m}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Expected value */}
                        <p className="mt-3 text-xs text-indigo-700">
                          <span className="font-semibold">Impact attendu :</span> {report.expectedValue}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
                      disabled
                      title="Bientôt disponible"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Activer ce rapport
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </CollapsibleBlock>
        ))
      )}
    </section>
  );
}
