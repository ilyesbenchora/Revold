"use client";

import { useEffect, useRef, useState } from "react";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { listSavedReports, removeSavedReport, REPORTS_UPDATED_EVENT, type SavedReport } from "./saved-reports";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Rapports enregistrés d'un agent, affichés en CARROUSEL horizontal (navigation
 * gauche → droite). Se met à jour en direct quand un rapport est enregistré
 * depuis le chat. Remplace l'ancienne section « Alertes » sous le chat.
 */
export function SavedReportsCarousel({ agentKey, title = "Rapports enregistrés" }: { agentKey: string; title?: string }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

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

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: "smooth" });
  }

  const hasMany = reports.length > 1;

  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
          {title}
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{reports.length}</span>
        </h2>
        {hasMany && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Précédent"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Suivant"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}
      </div>

      {hydrated && reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Aucun rapport enregistré. Lance une analyse dans le chat ci-dessus, puis clique sur
          <span className="font-medium text-slate-700"> « 💾 Enregistrer le rapport »</span> sous le rapport.
        </div>
      ) : (
        <div
          ref={trackRef}
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scroll-smooth"
        >
          {reports.map((r) => (
            <div
              key={r.id}
              className="card snap-start shrink-0 p-4"
              style={{ width: "min(560px, 88vw)" }}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{r.title}</h3>
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
