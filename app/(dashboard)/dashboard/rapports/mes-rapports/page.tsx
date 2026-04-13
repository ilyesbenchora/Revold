export const maxDuration = 60;
export const dynamic = "force-dynamic"; // never cache this page — always fresh KPIs

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
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
  description: string;
  expected_value: string;
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

  // ── 1. Fetch activated reports ──────────────────────────────────────────
  let activatedReports: ActivatedReport[] = [];
  try {
    const { data } = await supabase
      .from("activated_reports")
      .select("*")
      .eq("organization_id", orgId)
      .order("activated_at", { ascending: false });
    activatedReports = (data ?? []) as ActivatedReport[];
  } catch {}

  // ── 2. Resolve HubSpot token ───────────────────────────────────────────
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // ── 3. Compute KPIs ────────────────────────────────────────────────────
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

  // ── 4. Auto-fix orphaned metrics ───────────────────────────────────────
  // If a report has metrics that don't exist in kpiValues, replace them
  // with metrics that DO exist (from the same computeMetricValues output).
  const allComputedKeys = new Set(
    Object.entries(kpiValues)
      .filter(([, v]) => v !== null)
      .map(([k]) => k),
  );

  for (const report of activatedReports) {
    const metrics = (report.metrics as string[]) ?? [];
    const hasOrphan = metrics.some((m) => !allComputedKeys.has(m));

    if (hasOrphan && allComputedKeys.size > 0) {
      // Replace orphaned metrics with available ones from the same pool
      const fixedMetrics = metrics.map((m) => {
        if (allComputedKeys.has(m)) return m; // metric exists, keep it
        return null; // orphaned, will be filtered
      }).filter((m): m is string => m !== null);

      // Update in DB (fire-and-forget)
      if (fixedMetrics.length !== metrics.length) {
        report.metrics = fixedMetrics.length > 0 ? fixedMetrics : metrics;
        supabase
          .from("activated_reports")
          .update({ metrics: report.metrics })
          .eq("id", report.id)
          .then(() => {});
      }
    }
  }

  // ── 5. Counts ──────────────────────────────────────────────────────────
  const noToken = !hubspotToken;
  const catLabels = DISPLAY_CATEGORY_LABELS as Record<string, string>;
  const myCount = activatedReports.length;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vos rapports activés avec les KPIs en temps réel depuis votre CRM.
        </p>
      </header>

      <RapportsTabs myCount={myCount} singleCount={0} multiCount={0} />

      {/* Error banners */}
      {noToken && activatedReports.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Token HubSpot non trouvé — les KPIs ne peuvent pas être calculés.
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Vérifiez la connexion HubSpot dans{" "}
            <Link href="/dashboard/parametres/integrations" className="underline">Paramètres → Intégrations</Link>.
          </p>
        </div>
      )}
      {kpiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Erreur lors du chargement des données CRM.
          </p>
          <p className="mt-1 text-xs text-red-600 font-mono">{kpiError}</p>
        </div>
      )}

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
            Parcourez les suggestions et activez les rapports qui correspondent à vos besoins.
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

            const metricValues: (string | null)[] = metrics.map(
              (m) => kpiValues[m] ?? null,
            );
            const nonNullCount = metricValues.filter((v) => v !== null).length;
            const hasRealData = nonNullCount > 0;
            const allDataReady = nonNullCount === metrics.length && metrics.length > 0;

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
                      </div>
                      {report.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{report.description}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-slate-400">
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

                {/* Expected value */}
                {report.expected_value && (
                  <div className="border-t border-card-border px-5 py-3 bg-indigo-50/30">
                    <p className="text-xs text-indigo-700">
                      <span className="font-semibold">Impact attendu :</span> {report.expected_value}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-card-border px-5 py-3">
                  {allDataReady ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Toutes les données synchronisées
                    </span>
                  ) : hasRealData ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Données partielles ({nonNullCount}/{metrics.length} KPIs)
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
