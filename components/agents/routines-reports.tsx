"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportArtifact } from "./report-artifact";
import { REPORTS_UPDATED_EVENT, listSavedReports, removeSavedReport, type SavedReport } from "./saved-reports";
import { AgentAvatar } from "./agent-avatar";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { stripPeriodFromTitle } from "@/lib/reports/title";

/**
 * Rapports produits par les ROUTINES (récurrents, générés automatiquement).
 * Séparés des rapports libres : ils ont leur propre cycle de vie (une routine
 * les régénère à chaque échéance) et se lisent par routine, pas par agent.
 * Le câblage reste corrigeable ici, et la correction est persistée.
 */
function fmtDate(ts: number | string | null): string {
  if (ts == null) return "";
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function RoutinesReports() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setReports(listSavedReports());
    refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    window.addEventListener(REPORTS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(REPORTS_UPDATED_EVENT, refresh);
  }, []);

  function del(id: string) {
    removeSavedReport(id);
    setReports(listSavedReports());
  }

  const items = reports.filter((r) => r.origin === "routine").sort((a, b) => b.savedAt - a.savedAt);

  // Regroupement par ROUTINE (libellé), pas par agent : c'est la routine qui
  // rythme la production de ces rapports.
  const byRoutine = new Map<string, SavedReport[]>();
  for (const r of items) {
    const key = r.routineLabel || "Routine sans nom";
    if (!byRoutine.has(key)) byRoutine.set(key, []);
    byRoutine.get(key)!.push(r);
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucun rapport de routine pour l&apos;instant. Depuis le chat d&apos;un agent, onglet « Routines », crée un récap
        récurrent : chaque exécution déposera son rapport ici.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-slate-400">
        {items.length} rapport{items.length > 1 ? "s" : ""} généré{items.length > 1 ? "s" : ""} automatiquement
      </p>
      {[...byRoutine.entries()].map(([routineLabel, list]) => {
        const persona = getAgentPersona(list[0].agentKey);
        return (
          <section key={routineLabel} className="space-y-3">
            <div className="flex items-center gap-2">
              <AgentAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(list[0].agentKey)} size={28} />
              <h3 className="text-sm font-semibold text-slate-900">🕘 {routineLabel}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{list.length}</span>
              <Link
                href={`/dashboard/agents/${list[0].agentKey}`}
                className="ml-auto text-[11px] font-medium text-accent hover:underline"
              >
                Gérer la routine →
              </Link>
            </div>
            <div className="space-y-4">
              {list.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-slate-900">{stripPeriodFromTitle(r.title)}</h4>
                      <p className="text-xs text-slate-400">Généré le {fmtDate(r.savedAt)} · {r.agentLabel}</p>
                    </div>
                    <button
                      onClick={() => del(r.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      Supprimer
                    </button>
                  </div>
                  {r.analysis && (
                    <p className="mb-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                      {r.analysis}
                    </p>
                  )}
                  <ReportArtifact
                    agentKey={r.agentKey}
                    agentLabel={r.agentLabel}
                    report={r.report}
                    chart={r.chart}
                    savedReportId={r.id}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
