export const maxDuration = 60;

export const dynamic = "force-dynamic";

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, type ReportSuggestion } from "@/lib/reports/report-suggestions";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";
import { MultiToolBanner } from "@/components/multi-tool-banner";
import { getConnectedTools, summarizeConnected } from "@/lib/integrations/connected-tools";

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
  let kpiPreview: Record<string, string | null> = {};
  if (hubspotToken) {
    let integrations: Awaited<ReturnType<typeof detectIntegrations>> = [];
    try {
      integrations = await detectIntegrations(hubspotToken);
    } catch {}

    // Compute real field completeness for accurate reliability %
    let fieldCompleteness: Record<string, number> | undefined;
    if (orgId) {
      try {
        const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
        kpiPreview = computeMetricValues(kpiData);
        const tc = kpiData.contacts.total || 1;
        const td = kpiData.deals.total || 1;
        fieldCompleteness = {
          contactsWithOwner: Math.round(((tc - kpiData.contacts.orphans) / tc) * 100),
          contactsWithPhone: Math.round((kpiData.contacts.withPhone / tc) * 100),
          contactsWithCompany: Math.round(((tc - kpiData.contacts.withoutCompany) / tc) * 100),
          dealsWithAmount: td > 0 ? Math.round(((td - kpiData.deals.orphans) / td) * 100) : 70,
          dealsWithCloseDate: 70,
        };
      } catch {}
    }

    suggestions = getReportSuggestions(integrations, fieldCompleteness);
  }

  // Filter out already activated reports
  const available = suggestions.filter((r) => !activatedIds.has(r.id));

  const tabCounts = orgId ? await getTabCounts(supabase, orgId) : { myCount: 0, singleCount: 0, multiCount: 0 };
  tabCounts.singleCount = available.length;

  const connectedSummary = orgId
    ? summarizeConnected(await getConnectedTools(supabase, orgId))
    : summarizeConnected([]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports suggérés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports tirés d&apos;un seul outil métier connecté. Filtrez par catégorie.
        </p>
      </header>

      <RapportsTabs myCount={tabCounts.myCount} singleCount={tabCounts.singleCount} multiCount={tabCounts.multiCount} />

      <MultiToolBanner summary={connectedSummary} />

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
