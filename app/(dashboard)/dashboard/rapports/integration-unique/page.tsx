export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, type ReportSuggestion } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";

export default async function RapportsIntegrationUniquePage() {
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  let suggestions: ReportSuggestion[] = [];
  let multiCount = 0;

  if (hubspotTokenConfigured) {
    try {
      const integrations = await detectIntegrations(process.env.HUBSPOT_ACCESS_TOKEN!);
      suggestions = getReportSuggestions(integrations);
      multiCount = getCrossSourceReports(integrations).length;
    } catch {}
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports suggérés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports tirés d&apos;un seul outil métier connecté. Filtrez par catégorie pour trouver le rapport qui correspond à votre besoin.
        </p>
      </header>

      <RapportsTabs myCount={0} singleCount={suggestions.length} multiCount={multiCount} />

      <ReportListWithFilter
        reports={suggestions.map((r) => ({
          id: r.id,
          displayCategory: r.displayCategory,
          title: r.title,
          description: r.description,
          metrics: r.metrics,
          expectedValue: r.expectedValue,
          priority: r.priority,
          icon: r.icon,
          reliabilityPct: r.reliabilityPct,
          sourceIntegrations: r.sourceIntegrations,
        }))}
        variant="single"
      />
    </section>
  );
}
