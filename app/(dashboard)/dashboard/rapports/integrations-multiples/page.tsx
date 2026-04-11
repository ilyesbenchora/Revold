export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";
import Link from "next/link";

export default async function RapportsIntegrationsMultiplesPage() {
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let crossReports: ReturnType<typeof getCrossSourceReports> = [];
  let singleCount = 0;

  if (hubspotTokenConfigured) {
    try {
      const integrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!);
      singleCount = getReportSuggestions(integrations).length;
      crossReports = getCrossSourceReports(integrations);
    } catch {}
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports cross-sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports qui croisent <strong>plusieurs outils métiers</strong> pour des insights impossibles avec un seul outil.
          Filtrez par catégorie pour trouver le rapport qui correspond à votre besoin.
        </p>
      </header>

      <RapportsTabs myCount={0} singleCount={singleCount} multiCount={crossReports.length} />

      {crossReports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun rapport croisé activable. Connectez au moins <strong>2 outils métiers de catégories différentes</strong> pour débloquer les rapports cross-sources.
          </p>
          <Link href="/dashboard/integration" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">
            Voir les intégrations →
          </Link>
        </div>
      ) : (
        <ReportListWithFilter
          reports={crossReports.map((r) => ({
            id: r.id,
            displayCategory: r.displayCategory,
            title: r.title,
            description: r.description,
            metrics: r.metrics,
            expectedValue: r.expectedValue,
            priority: r.priority,
            icon: r.icon,
            reliabilityPct: r.reliabilityPct,
            requiredCategories: r.requiredCategories,
          }))}
          variant="multi"
        />
      )}
    </section>
  );
}
