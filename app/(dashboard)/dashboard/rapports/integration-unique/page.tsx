export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, type ReportSuggestion } from "@/lib/reports/report-suggestions";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";

export default async function RapportsIntegrationUniquePage() {
  const [supabase, orgId] = await Promise.all([
    createSupabaseServerClient(),
    getOrgId(),
  ]);

  const hubspotToken = orgId ? await getHubSpotToken(supabase, orgId) : null;

  // Fetch activated report IDs to exclude them
  let activatedIds = new Set<string>();
  if (orgId) {
    const { data } = await supabase
      .from("activated_reports")
      .select("report_id")
      .eq("organization_id", orgId);
    activatedIds = new Set((data ?? []).map((r) => r.report_id));
  }

  let suggestions: ReportSuggestion[] = [];
  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      suggestions = getReportSuggestions(integrations);
    } catch {}
  }

  // Filter out already activated reports
  const available = suggestions.filter((r) => !activatedIds.has(r.id));

  let kpiPreview: Record<string, string | null> = {};
  if (hubspotToken && orgId) {
    try {
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
      kpiPreview = computeMetricValues(kpiData);
    } catch {}
  }

  const tabCounts = orgId ? await getTabCounts(supabase, orgId) : { myCount: 0, singleCount: 0, multiCount: 0 };
  tabCounts.singleCount = available.length;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports suggérés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports tirés d&apos;un seul outil métier connecté. Filtrez par catégorie.
        </p>
      </header>

      <RapportsTabs myCount={tabCounts.myCount} singleCount={tabCounts.singleCount} multiCount={tabCounts.multiCount} />

      <ReportListWithFilter
        reports={available.map((r) => ({
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
