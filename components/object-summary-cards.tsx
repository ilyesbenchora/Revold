/**
 * Cartes « Synthèse par objet » (Contacts / Entreprises / Transactions) :
 * volume + barres de complétude des propriétés clés. Déplacées de la vue
 * d'ensemble Audit données vers la sous-page HubSpot.
 */

import { getBarColor } from "@/lib/score-utils";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import type { ObjectSummary } from "@/lib/audit/object-summaries";

export function ObjectSummaryCards({ summaries }: { summaries: ObjectSummary[] }) {
  const visible = summaries.filter((s) => s.count > 0 || s.metrics.length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {visible.map((s) => (
        <div key={s.label} className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BlockHeaderIcon icon={s.icon} tone={s.tone} />
              <span className="text-sm font-semibold text-slate-900">{s.label}</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{s.count.toLocaleString("fr-FR")}</span>
          </div>
          <div className="mt-3 space-y-2">
            {s.metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {m.label}
                    {m.missing && (
                      <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700" title="Créez la propriété dans HubSpot puis mappez-la dans Paramètres → Modèle de données">
                        propriété absente du CRM
                      </span>
                    )}
                  </span>
                  <span className={`font-semibold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.pct} %</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${getBarColor(m.pct)}`} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
