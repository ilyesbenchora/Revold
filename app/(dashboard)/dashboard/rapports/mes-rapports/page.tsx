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

  // Auto-fix orphaned metrics
  const computedKeys = new Set(Object.entries(kpiValues).filter(([, v]) => v !== null).map(([k]) => k));
  for (const report of activatedReports) {
    const metrics = (report.metrics as string[]) ?? [];
    const fixed = metrics.filter((m) => computedKeys.has(m));
    if (fixed.length !== metrics.length && fixed.length > 0) {
      report.metrics = fixed;
      supabase.from("activated_reports").update({ metrics: fixed }).eq("id", report.id).then(() => {});
    }
  }

  // Tab counts (shared across all rapport pages)
  const tabCounts = await getTabCounts(supabase, orgId);
  tabCounts.myCount = activatedReports.length; // use fresh count

  const noToken = !hubspotToken;
  const catLabels = DISPLAY_CATEGORY_LABELS as Record<string, string>;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs en temps réel depuis votre CRM.
        </p>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                className={`card overflow-hidden transition hover:shadow-md ${
                  isMulti ? "border-t-2 border-t-fuchsia-500" : "border-t-2 border-t-accent"
                }`}
              >
                {/* Header — compact */}
                <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{report.icon || "📊"}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{report.title}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                          isMulti ? "bg-fuchsia-50 text-fuchsia-600" : "bg-indigo-50 text-indigo-600"
                        }`}>
                          {catLabel}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(report.activated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPI Grid — compact cards */}
                {metrics.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((metric, idx) => {
                        const val = metricValues[idx];
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg p-2.5 ${
                              val !== null ? "bg-slate-50" : "bg-slate-50/50"
                            }`}
                          >
                            <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{metric}</p>
                            <p className={`mt-0.5 text-xs tabular-nums leading-snug ${
                              val !== null ? "text-slate-800" : "text-slate-300"
                            }`}>
                              {val ?? "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer — minimal */}
                <div className="flex items-center justify-between border-t border-card-border px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    {allReady ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    ) : nonNullCount > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    )}
                    <span className="text-[10px] text-slate-400">
                      {allReady
                        ? "Synchronisé"
                        : nonNullCount > 0
                          ? `${nonNullCount}/${metrics.length} KPIs`
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
