"use client";

import { useEffect, useState } from "react";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { listSavedReports, removeSavedReport, REPORTS_UPDATED_EVENT, type SavedReport } from "./saved-reports";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Rapports de projection enregistrés pour un agent donné (page de prévision).
 * Se met à jour en direct quand une projection est enregistrée depuis le chat.
 */
export function SavedProjections({ agentKey }: { agentKey: string }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [hydrated, setHydrated] = useState(false);

  function refresh() {
    setReports(listSavedReports().filter((r) => r.agentKey === agentKey));
  }

  useEffect(() => {
    refresh();
    setHydrated(true);
    const onUpdate = () => refresh();
    window.addEventListener(REPORTS_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(REPORTS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  function del(id: string) {
    removeSavedReport(id);
    refresh();
  }

  return (
    <section className="mt-6 space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
        Rapports de projection enregistrés
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{reports.length}</span>
      </h2>

      {hydrated && reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Aucune projection enregistrée. Lance une projection dans le chat ci-dessus, puis clique sur
          <span className="font-medium text-slate-700"> « 📌 Enregistrer cette projection »</span> sous le rapport.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                  <div className="text-xs text-slate-400">Enregistré le {fmtDate(r.savedAt)}</div>
                </div>
                <button
                  onClick={() => del(r.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  Supprimer
                </button>
              </div>
              {r.report && <AgentReport spec={r.report} />}
              {r.chart && <ChartPicker proposal={r.chart} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
