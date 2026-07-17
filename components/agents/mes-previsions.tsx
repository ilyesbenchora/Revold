"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportArtifact } from "./report-artifact";
import { AgentAvatar } from "./agent-avatar";
import { stripPeriodFromTitle } from "@/lib/reports/title";
import { listSavedReports, removeSavedReport, REPORTS_UPDATED_EVENT, type SavedReport } from "./saved-reports";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * « Mes prévisions » — les rapports de projection enregistrés depuis le chat des
 * agents de prévisions (clé `prev-*`), regroupés par agent. Se met à jour en
 * direct quand une prévision est enregistrée dans un chat.
 */
export function MesPrevisions() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [hydrated, setHydrated] = useState(false);

  function refresh() {
    setReports(listSavedReports().filter((r) => r.agentKey.startsWith("prev-")));
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
  }, []);

  function del(id: string) {
    removeSavedReport(id);
    refresh();
  }

  // Regroupe par agent de prévision.
  const byAgent = new Map<string, { label: string; items: SavedReport[] }>();
  for (const r of reports) {
    if (!byAgent.has(r.agentKey)) byAgent.set(r.agentKey, { label: r.agentLabel, items: [] });
    byAgent.get(r.agentKey)!.items.push(r);
  }

  if (hydrated && reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500">
          Aucune prévision enregistrée. Ouvre un agent de prévisions, lance une projection dans le chat, puis clique sur
          <span className="font-medium text-slate-700"> « 💾 Enregistrer le rapport »</span> pour la retrouver ici.
        </p>
        <Link
          href="/dashboard/simulations"
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Lancer une prévision →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...byAgent.entries()].map(([agentKey, group]) => {
        const p = getAgentPersona(agentKey);
        return (
          <div key={agentKey} className="space-y-3">
            <div className="flex items-center gap-2">
              <AgentAvatar name={p.name} emoji={p.emoji} image={personaImagePath(agentKey)} size={28} />
              <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{group.items.length}</span>
            </div>
            <div className="space-y-4">
              {group.items.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900">{stripPeriodFromTitle(r.title)}</h4>
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
        );
      })}
    </div>
  );
}
