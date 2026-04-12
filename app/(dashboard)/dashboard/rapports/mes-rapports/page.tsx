export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { detectIntegrations } from "@/lib/integrations/detect-integrations";
import { getReportSuggestions } from "@/lib/reports/report-suggestions";
import { getCrossSourceReports } from "@/lib/reports/cross-source-reports";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
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
  metrics: string[];
  icon: string;
  activated_at: string;
};

export default async function MesRapportsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Fetch activated reports
  let activatedReports: ActivatedReport[] = [];
  try {
    const { data } = await supabase
      .from("activated_reports")
      .select("*")
      .eq("organization_id", orgId)
      .order("activated_at", { ascending: false });
    activatedReports = (data ?? []) as ActivatedReport[];
  } catch {}

  // Resolve HubSpot token from OAuth (stored in integrations table)
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  // Tab counts
  let singleCount = 0;
  let multiCount = 0;
  if (hubspotToken) {
    try {
      const integrations = await detectIntegrations(hubspotToken);
      singleCount = getReportSuggestions(integrations).length;
      multiCount = getCrossSourceReports(integrations).length;
    } catch {}
  }

  // Compute KPIs for all categories
  let kpiValues: Record<string, string | null> = {};
  if (hubspotToken && activatedReports.length > 0) {
    try {
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
      kpiValues = computeMetricValues(kpiData);
      // Debug: log data counts and metric matching
      console.log("[mes-rapports] HubSpot data:", {
        contacts: kpiData.contacts.total,
        deals: kpiData.deals.total,
        calls: kpiData.calls.total,
        meetings: kpiData.meetings.total,
        emails: kpiData.emails.totalSent,
        tickets: kpiData.tickets.total,
        companies: kpiData.companies.total,
        dealsWithCalls: kpiData.deals.dealsWithCalls,
        dealsWithMeetings: kpiData.deals.dealsWithMeetings,
      });
      console.log("[mes-rapports] kpiValues computed:", Object.keys(kpiValues).length, "keys,", Object.values(kpiValues).filter(v => v !== null).length, "non-null");
      // Check first report metric matching
      const firstReport = activatedReports[0];
      if (firstReport) {
        const metrics = (firstReport.metrics as string[]) ?? [];
        const matches = metrics.map(m => ({ metric: m, value: kpiValues[m] ?? "NO_MATCH" }));
        console.log("[mes-rapports] Report:", firstReport.title);
        console.log("[mes-rapports] Metric matches:", JSON.stringify(matches));
      }
    } catch (err) {
      console.error("[mes-rapports] KPI ERROR:", err);
    }
  } else {
    console.log("[mes-rapports] SKIPPED — token:", !!hubspotToken, "reports:", activatedReports.length);
  }

  const myCount = activatedReports.length;
  const catLabels = DISPLAY_CATEGORY_LABELS as Record<string, string>;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vos rapports activés. Chaque rapport affiche les KPIs clés basés sur vos données CRM en temps réel.
        </p>
      </header>

      <RapportsTabs myCount={myCount} singleCount={singleCount} multiCount={multiCount} />

      {activatedReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">Aucun rapport activé</p>
          <p className="mt-1 text-xs text-slate-500">
            Parcourez les suggestions de rapports et activez ceux qui correspondent à vos besoins.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/dashboard/rapports/integration-unique" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">
              Intégration unique
            </Link>
            <Link href="/dashboard/rapports/integrations-multiples" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
              Intégrations multiples
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activatedReports.map((report) => {
            const catLabel = catLabels[report.display_category] ?? report.display_category;
            const metrics = (report.metrics as string[]) ?? [];
            const isMulti = report.report_type === "multi";

            // Resolve KPI value for each metric label from the universal map
            const metricValues: (string | null)[] = metrics.map(
              (m) => kpiValues[m] ?? null,
            );
            const hasRealData = metricValues.some((v) => v !== null);

            return (
              <article
                key={report.id}
                className={`card overflow-hidden ${isMulti ? "border-l-4 border-l-fuchsia-500" : "border-l-4 border-l-accent"}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{report.icon || "📊"}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-900">{report.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isMulti ? "bg-fuchsia-50 text-fuchsia-700" : "bg-indigo-50 text-indigo-700"
                        }`}>
                          {catLabel}
                        </span>
                        {isMulti && (
                          <span className="rounded-full bg-gradient-to-r from-fuchsia-50 to-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            🔗 Multi-sources
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Activé le {new Date(report.activated_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Grid */}
                {metrics.length > 0 && (
                  <div className="border-t border-card-border bg-slate-50/50 px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      KPIs du rapport
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {metrics.map((metric, idx) => {
                        const val = metricValues[idx];
                        return (
                          <div key={idx} className="rounded-lg bg-white p-3 shadow-sm">
                            <p className="text-xs text-slate-500 line-clamp-2">{metric}</p>
                            <p className={`mt-1 text-2xl font-bold tabular-nums ${val !== null ? "text-slate-900" : "text-slate-300"}`}>
                              {val ?? "—"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {val !== null ? "CRM en direct" : "Données en attente"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-card-border px-5 py-3">
                  {hasRealData ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      ✓ Données CRM synchronisées
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      En attente de synchronisation
                    </span>
                  )}
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
