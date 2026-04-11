"use client";

import { useState } from "react";
import Link from "next/link";

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
  sourceIntegrations?: Array<{ key: string; label: string; icon: string }>;
  requiredCategories?: string[];
};

type Props = {
  reports: Report[];
  variant: "single" | "multi";
};

export function ReportListWithFilter({ reports, variant }: Props) {
  const [active, setActive] = useState("all");

  // Count per category
  const counts: Record<string, number> = {};
  for (const r of reports) {
    counts[r.displayCategory] = (counts[r.displayCategory] || 0) + 1;
  }

  const filtered = active === "all" ? reports : reports.filter((r) => r.displayCategory === active);
  const isMulti = variant === "multi";

  const borderColor = isMulti ? "border-l-fuchsia-500" : "border-l-emerald-500";
  const accentGradient = isMulti
    ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white"
    : "bg-accent text-white hover:bg-indigo-500";

  return (
    <div className="space-y-6">
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
                      {report.metrics.map((m) => (
                        <li key={m} className="flex items-start gap-1.5 text-xs text-slate-700">
                          <span className={`mt-0.5 ${isMulti ? "text-fuchsia-500" : "text-emerald-500"}`}>✓</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className={`mt-3 text-xs ${isMulti ? "text-fuchsia-700" : "text-indigo-700"}`}>
                    <span className="font-semibold">Impact attendu :</span> {report.expectedValue}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={`/dashboard/rapports/mes-rapports?activate=${encodeURIComponent(report.id)}&title=${encodeURIComponent(report.title)}`}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 ${accentGradient}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {isMulti ? "Activer ce rapport croisé" : "Activer ce rapport"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
