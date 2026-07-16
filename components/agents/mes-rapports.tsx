"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportArtifact } from "./report-artifact";
import { SAVED_REPORTS_KEY, listSavedReports, removeSavedReport, type SavedReport } from "./saved-reports";
import { AgentAvatar } from "./agent-avatar";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

function fmtDate(ts: number | string | null): string {
  if (ts == null) return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function MesRapports() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedReport[];
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setReports(parsed);
        }
      }
    } catch {
      /* localStorage indisponible */
    }
    setHydrated(true);
  }, []);

  function del(id: string) {
    removeSavedReport(id);
    setReports(listSavedReports());
  }

  const sorted = [...reports].sort((a, b) => b.savedAt - a.savedAt);
  // Regroupe par agent → un « dashboard » par agent.
  const byAgent = new Map<string, { label: string; items: SavedReport[] }>();
  for (const r of sorted) {
    if (!byAgent.has(r.agentKey)) byAgent.set(r.agentKey, { label: r.agentLabel, items: [] });
    byAgent.get(r.agentKey)!.items.push(r);
  }

  return (
    <div className="space-y-8">
      {/* Rapports enregistrés, regroupés par agent */}
      <section className="space-y-5">
        <h2 className="text-base font-semibold text-slate-900">
          Rapports enregistrés{reports.length > 0 ? ` (${reports.length})` : ""}
        </h2>
        {hydrated && reports.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucun rapport enregistré pour l&apos;instant. Depuis un agent, clique sur « Enregistrer le rapport » sous un
            rapport pour le retrouver ici.
          </div>
        ) : (
          <div className="space-y-6">
            {[...byAgent.entries()].map(([agentKey, group]) => (
              <div key={agentKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <AgentAvatar name={getAgentPersona(agentKey).name} emoji={getAgentPersona(agentKey).emoji} image={personaImagePath(agentKey)} size={28} />
                  <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{group.items.length}</span>
                  <Link href={`/dashboard/agents/${agentKey}`} className="ml-auto text-[11px] font-medium text-accent hover:underline">
                    Ouvrir l&apos;agent →
                  </Link>
                </div>
                <div className="space-y-4">
                  {group.items.map((r) => (
                    <div key={r.id} className="card p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900">{r.title}</h4>
                          <div className="text-xs text-slate-400">Enregistré le {fmtDate(r.savedAt)}</div>
                        </div>
                        <button
                          onClick={() => del(r.id)}
                          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          Supprimer
                        </button>
                      </div>
                      <ReportArtifact agentKey={r.agentKey} agentLabel={r.agentLabel} report={r.report} chart={r.chart} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
