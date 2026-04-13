export const maxDuration = 60;

import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions, getToolCategory } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { RapportsTabs } from "@/components/rapports-tabs";
import { ReportListWithFilter } from "@/components/report-list-with-filter";
import Link from "next/link";

export default async function RapportsIntegrationsMultiplesPage() {
  // ── Resolve auth context ─────────────────────────────────────────────────
  const [supabase, orgId] = await Promise.all([
    createSupabaseServerClient(),
    getOrgId(),
  ]);

  // Resolve HubSpot token from OAuth (stored in integrations table)
  const hubspotToken = orgId ? await getHubSpotToken(supabase, orgId) : null;

  // ── 1. HubSpot-detected integrations (for single-count + reliability) ────
  let hubspotDetected: DetectedIntegration[] = [];
  let singleCount = 0;
  if (hubspotToken) {
    try {
      hubspotDetected = await detectIntegrations(hubspotToken);
      singleCount = getReportSuggestions(hubspotDetected).length;
    } catch {}
  }

  // ── 2. Revold-connected tools (from Supabase `integrations` table) ───────
  let revoldConnected: DetectedIntegration[] = [];
  let availableTools: Array<{
    key: string;
    label: string;
    icon: string;
    toolCategory?: string;
  }> = [];

  if (orgId) {
    try {
      const { data } = await supabase
        .from("integrations")
        .select("provider")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      const mapped: (DetectedIntegration | null)[] = (data ?? []).map((row) => {
          const catalog = CONNECTABLE_TOOLS[row.provider];
          if (!catalog) return null;
          // Build a minimal DetectedIntegration so getCrossSourceReports can
          // recognise the tool category (billing / support / etc.)
          return {
            key: row.provider,
            label: catalog.label,
            vendor: catalog.vendor,
            icon: catalog.icon,
            objectTypes: [] as string[],
            totalProperties: 0,
            enrichedRecords: 0,
            totalRecords: 0,
            enrichmentRate: 70,
            topProperties: [],
            distinctUsers: 0,
            topUsers: [],
            detectionMethods: [] as DetectedIntegration["detectionMethods"],
          } satisfies DetectedIntegration;
        });
      revoldConnected = mapped.filter((x): x is DetectedIntegration => x !== null);

      // availableTools: all Revold-connected tools with their ToolCategory
      availableTools = revoldConnected.map((i) => {
        const cat = getToolCategory(i.key);
        return {
          key: i.key,
          label: i.label,
          icon: i.icon,
          toolCategory: cat !== "other" ? cat : undefined,
        };
      });
    } catch {}
  }

  // ── 3. Cross-source reports: union of HubSpot + Revold tools ────────────
  const mergedIntegrations = [...hubspotDetected, ...revoldConnected];
  const allCrossReports = getCrossSourceReports(mergedIntegrations);

  // ── 3b. Exclude already activated reports ─────────────────────────────
  let activatedIds = new Set<string>();
  if (orgId) {
    const { data } = await supabase
      .from("activated_reports")
      .select("report_id")
      .eq("organization_id", orgId);
    activatedIds = new Set((data ?? []).map((r) => r.report_id));
  }
  const crossReports = allCrossReports.filter((r) => !activatedIds.has(r.id));

  // ── 4. KPI preview ───────────────────────────────────────────────────────
  let kpiPreview: Record<string, string | null> = {};
  if (hubspotToken && orgId) {
    try {
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
      kpiPreview = computeMetricValues(kpiData);
    } catch {}
  }

  // ── 5. Tab counts ──────────────────────────────────────────────────────
  const tabCounts = orgId ? await getTabCounts(supabase, orgId) : { myCount: 0, singleCount: singleCount, multiCount: crossReports.length };
  tabCounts.multiCount = crossReports.length; // use fresh count from this page

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports cross-sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rapports qui croisent <strong>plusieurs outils métiers</strong> pour des insights impossibles avec un seul outil.
          Filtrez par catégorie pour trouver le rapport qui correspond à votre besoin.
        </p>
      </header>

      <RapportsTabs myCount={tabCounts.myCount} singleCount={tabCounts.singleCount} multiCount={tabCounts.multiCount} />

      {crossReports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun rapport croisé activable. Connectez au moins{" "}
            <strong>2 outils métiers de catégories différentes</strong> pour débloquer les rapports cross-sources.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/dashboard/integration"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Connecter un outil →
            </Link>
          </div>
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
          availableTools={availableTools}
          kpiPreview={kpiPreview}
        />
      )}
    </section>
  );
}
