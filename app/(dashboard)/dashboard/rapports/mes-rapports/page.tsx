export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { RapportsTabs } from "@/components/rapports-tabs";
import { DISPLAY_CATEGORY_LABELS } from "@/lib/reports/report-suggestions";
import Link from "next/link";
import { DeactivateReportButton } from "@/components/deactivate-report-button";
import { KpiVisual } from "@/components/kpi-visual";

type ActivatedReport = {
  id: string;
  report_id: string;
  report_type: string;
  title: string;
  display_category: string;
  description: string;
  expected_value: string;
  metrics: string[];
  icon: string;
  activated_at: string;
};

/** Clean raw metric values: remove "Won:", "Lost:", "Out:", "In:" prefixes,
 *  split compound values into separate lines, remove colons. */
function cleanValue(raw: string): string {
  return raw
    .replace(/\bWon\s*:\s*/gi, "")
    .replace(/\bLost\s*:\s*/gi, "")
    .replace(/\bOut\s*:\s*/gi, "")
    .replace(/\bIn\s*:\s*/gi, "")
    .replace(/\bAvec\s*:\s*/gi, "")
    .replace(/\bSans\s*:\s*/gi, "")
    .replace(/\bTop\s*:\s*/gi, "")
    .replace(/\s*\/\s*/g, "  ·  ")
    .replace(/\s*,\s*/g, "  ·  ")
    .trim();
}

export default async function MesRapportsPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();

  let activatedReports: ActivatedReport[] = [];
  try {
    const { data } = await supabase
      .from("activated_reports")
      .select("*")
      .eq("organization_id", orgId)
      .order("activated_at", { ascending: false });
    activatedReports = (data ?? []) as ActivatedReport[];
  } catch {}

  const hubspotToken = await getHubSpotToken(supabase, orgId);

  let kpiValues: Record<string, string | null> = {};
  let kpiError: string | null = null;
  if (hubspotToken && activatedReports.length > 0) {
    try {
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
      kpiValues = computeMetricValues(kpiData);
    } catch (err) {
      kpiError = String(err).slice(0, 200);
    }
  }

  // Auto-fix: update metrics in DB if they reference keys that don't exist in kpiValues
  const computedKeys = new Set(Object.keys(kpiValues));
  for (const report of activatedReports) {
    const metrics = (report.metrics as string[]) ?? [];
    if (computedKeys.size > 0 && metrics.some((m) => !computedKeys.has(m))) {
      const fixed = metrics.filter((m) => computedKeys.has(m));
      if (fixed.length > 0 && fixed.length !== metrics.length) {
        report.metrics = fixed;
        supabase.from("activated_reports").update({ metrics: fixed }).eq("id", report.id).then(() => {});
      }
    }
  }

  const tabCounts = await getTabCounts(supabase, orgId);
  tabCounts.myCount = activatedReports.length;

  const noToken = !hubspotToken;
  const catLabels = DISPLAY_CATEGORY_LABELS as Record<string, string>;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">KPIs en temps réel depuis votre CRM.</p>
      </header>

      <RapportsTabs myCount={tabCounts.myCount} singleCount={tabCounts.singleCount} multiCount={tabCounts.multiCount} />

      {noToken && activatedReports.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Token HubSpot non trouvé.{" "}
            <Link href="/dashboard/parametres/integrations" className="underline">Configurer →</Link>
          </p>
        </div>
      )}
      {kpiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-800">Erreur CRM : {kpiError}</p>
        </div>
      )}

      {activatedReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Aucun rapport activé</p>
          <p className="mt-1 text-xs text-slate-500">Activez des rapports depuis les suggestions.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/dashboard/rapports/integration-unique" className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500">
              Intégration unique
            </Link>
            <Link href="/dashboard/rapports/integrations-multiples" className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-xs font-medium text-white hover:opacity-90">
              Intégrations multiples
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {activatedReports.map((report) => {
            const catLabel = catLabels[report.display_category] ?? report.display_category;
            const metrics = (report.metrics as string[]) ?? [];
            const isMulti = report.report_type === "multi";
            const metricValues = metrics.map((m) => kpiValues[m] ?? null);
            const nonNullCount = metricValues.filter((v) => v !== null).length;
            const allReady = nonNullCount === metrics.length && metrics.length > 0;

            return (
              <article
                key={report.id}
                className="card overflow-hidden transition hover:shadow-md"
              >
                {/* Color bar */}
                <div className={`h-1 ${isMulti ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500" : "bg-accent"}`} />

                {/* Header */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{report.icon || "📊"}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-semibold text-slate-900 leading-snug">{report.title}</h3>
                      {report.description && (
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2">{report.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          isMulti ? "bg-fuchsia-50 text-fuchsia-600" : "bg-indigo-50 text-indigo-600"
                        }`}>
                          {catLabel}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(report.activated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPIs */}
                {metrics.length > 0 && (
                  <div className="px-5 pb-4">
                    <div className="space-y-1.5">
                      {metrics.map((metric, idx) => (
                        <KpiVisual key={idx} label={metric} value={metricValues[idx]} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-card-border px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      allReady
                        ? "bg-emerald-50 text-emerald-700"
                        : nonNullCount > 0
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`h-1 w-1 rounded-full ${
                        allReady ? "bg-emerald-500" : nonNullCount > 0 ? "bg-blue-500" : "bg-amber-500"
                      }`} />
                      {allReady
                        ? `${metrics.length} KPIs synchronisés`
                        : nonNullCount > 0
                          ? `${nonNullCount} sur ${metrics.length} KPIs`
                          : "En attente"}
                    </span>
                  </div>
                  <DeactivateReportButton reportId={report.report_id} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
