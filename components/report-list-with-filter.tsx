"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "attribution", label: "Attribution" },
  { id: "chiffre_affaires", label: "Chiffre d'affaires" },
  { id: "facturation_paiement", label: "Facturation & Paiement" },
  { id: "service_client", label: "Service client" },
  { id: "qualite_donnees", label: "Qualité de données" },
  { id: "adoption_outils", label: "Adoption outils" },
  { id: "cycle_ventes", label: "Cycle de ventes" },
] as const;

type Report = {
  id: string;
  displayCategory: string;
  title: string;
  description: string;
  metrics: string[];
  expectedValue: string;
  priority: "high" | "medium" | "low";
  icon: string;
  reliabilityPct: number;
  sourceIntegrations?: Array<{ key: string; label: string; icon: string }>;
  requiredCategories?: string[];
};

type DetectedTool = {
  key: string;
  label: string;
  icon: string;
  /** ToolCategory this tool maps to — used to match requiredCategories in cross-source reports */
  toolCategory?: string;
};

type Props = {
  reports: Report[];
  variant: "single" | "multi";
  /** For multi variant: detected tools the user can select to cross */
  availableTools?: DetectedTool[];
  /** Pre-computed metric label → value map from fetchAllKpiData + computeMetricValues */
  kpiPreview?: Record<string, string | null>;
};

export function ReportListWithFilter({ reports, variant, availableTools, kpiPreview }: Props) {
  const [active, setActive] = useState("all");
  const [activating, setActivating] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const router = useRouter();

  const isMulti = variant === "multi";

  function toggleTool(key: string) {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleActivate(report: Report) {
    setActivating(report.id);
    try {
      const res = await fetch("/api/reports/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          reportType: variant,
          title: report.title,
          displayCategory: report.displayCategory,
          metrics: report.metrics,
          icon: report.icon,
          description: report.description,
          expectedValue: report.expectedValue,
        }),
      });
      if (res.ok) {
        router.push("/dashboard/rapports/mes-rapports");
      }
    } catch {
      // silently fail
    } finally {
      setActivating(null);
    }
  }

  // Count per category
  const counts: Record<string, number> = {};
  for (const r of reports) {
    counts[r.displayCategory] = (counts[r.displayCategory] || 0) + 1;
  }

  // If tools are selected in multi mode, further filter reports whose requiredCategories
  // overlap with the selected tool categories
  let visibleReports = reports;
  if (isMulti && selectedTools.size > 0) {
    visibleReports = reports.filter((r) => {
      if (!r.requiredCategories || r.requiredCategories.length === 0) return true;
      return r.requiredCategories.some((cat) => {
        // Match via toolCategory (Revold catalog → ToolCategory) or fall back to key
        return availableTools?.some(
          (t) => selectedTools.has(t.key) && (t.toolCategory ?? t.key) === cat,
        ) ?? false;
      }) || r.requiredCategories.length === 0;
    });
  }

  const filtered = active === "all" ? visibleReports : visibleReports.filter((r) => r.displayCategory === active);

  const borderColor = isMulti ? "border-l-fuchsia-500" : "border-l-emerald-500";
  const accentGradient = isMulti
    ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white"
    : "bg-accent text-white hover:bg-indigo-500";

  return (
    <div className="space-y-6">
      {/* Tool selector (multi mode only) */}
      {isMulti && availableTools && availableTools.length > 0 && (
        <div className="rounded-xl border border-card-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Choisissez les outils à croiser
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Sélectionnez les outils pour filtrer les rapports cross-sources pertinents.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTools.map((tool) => {
              const isSelected = selectedTools.has(tool.key);
              return (
                <button
                  key={tool.key}
                  type="button"
                  onClick={() => toggleTool(tool.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isSelected
                      ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-sm"
                      : "border border-card-border bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{tool.icon}</span>
                  {tool.label}
                  {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
            {selectedTools.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTools(new Set())}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline px-2"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = cat.id === "all" ? reports.length : (counts[cat.id] ?? 0);
          if (cat.id !== "all" && count === 0) return null;
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? isMulti
                    ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-sm"
                    : "bg-accent text-white shadow-sm"
                  : "border border-card-border bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Report list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">Aucun rapport dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <article
              key={report.id}
              className={`card p-5 ${report.priority === "high" ? `border-l-4 ${borderColor}` : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{report.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900">{report.title}</h3>
                    {report.priority === "high" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        Haute valeur
                      </span>
                    )}
                    {report.priority === "medium" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        Valeur moyenne
                      </span>
                    )}
                    {isMulti && report.requiredCategories && report.requiredCategories.length > 0 && (
                      <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                        🔗 {report.requiredCategories.length} outils
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      report.reliabilityPct >= 70 ? "bg-emerald-100 text-emerald-700" :
                      report.reliabilityPct >= 40 ? "bg-amber-100 text-amber-700" :
                      report.reliabilityPct > 0 ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {report.reliabilityPct > 0 ? `${report.reliabilityPct}% fiable` : "Données insuffisantes"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{report.description}</p>

                  {report.sourceIntegrations && report.sourceIntegrations.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">Sources :</span>
                      {report.sourceIntegrations.map((src) => (
                        <span
                          key={src.key}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          <span>{src.icon}</span>
                          {src.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      KPIs du rapport
                    </p>
                    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {report.metrics.map((m) => {
                        const val = kpiPreview?.[m] ?? null;
                        return (
                          <li key={m} className="flex items-start justify-between gap-2 text-xs text-slate-700">
                            <span className="flex items-start gap-1.5 min-w-0">
                              <span className={`mt-0.5 shrink-0 ${isMulti ? "text-fuchsia-500" : "text-emerald-500"}`}>✓</span>
                              <span className="line-clamp-2">{m}</span>
                            </span>
                            {val !== null && (
                              <span className="ml-1 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 tabular-nums">
                                {val}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <p className={`mt-3 text-xs ${isMulti ? "text-fuchsia-700" : "text-indigo-700"}`}>
                    <span className="font-semibold">Impact attendu :</span> {report.expectedValue}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleActivate(report)}
                  disabled={activating === report.id}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${accentGradient}`}
                >
                  {activating === report.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                  {activating === report.id
                    ? "Activation..."
                    : isMulti ? "Activer ce rapport croisé" : "Activer ce rapport"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
