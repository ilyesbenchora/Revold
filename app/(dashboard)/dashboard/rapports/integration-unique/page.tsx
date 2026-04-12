export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, type ReportSuggestion } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";

export default async function RapportsIntegrationUniquePage() {
  const [supabase, orgId] = await Promise.all([
    createSupabaseServerClient(),
    getOrgId(),
  ]);

  // Resolve HubSpot token from OAuth (stored in integrations table)
  const hubspotToken = orgId ? await getHubSpotToken(supabase, orgId) : null;

  let suggestions: ReportSuggestion[] = [];
  let multiCount = 0;

  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      suggestions = getReportSuggestions(integrations);
      multiCount = getCrossSourceReports(integrations).length;
    } catch {}
  }

  // Fetch & compute all KPIs
  let kpiPreview: Record<string, string | null> = {};
  if (hubspotToken && orgId) {
    try {
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
      kpiPreview = computeMetricValues(kpiData);
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
        kpiPreview={kpiPreview}
      />
    </section>
  );
}
