"use client";

import { useEffect, useRef, useState } from "react";
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

/** Bloc d'un agent : en-tête repliable + carrousel horizontal de ses rapports. */
function AgentReportsRow({
  agentKey,
  label,
  items,
  onDelete,
}: {
  agentKey: string;
  label: string;
  items: SavedReport[];
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const persona = getAgentPersona(agentKey);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: "smooth" });
  }

  const hasMany = items.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Déplier" : "Replier"}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <AgentAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(agentKey)} size={28} />
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{items.length}</span>

        <div className="ml-auto flex items-center gap-1.5">
          {!collapsed && hasMany && (
            <>
              <button type="button" onClick={() => scroll(-1)} aria-label="Précédent"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Suivant"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}
          <Link href={`/dashboard/agents/${agentKey}`} className="text-[11px] font-medium text-accent hover:underline">
            Ouvrir l&apos;agent →
          </Link>
        </div>
      </div>

      {!collapsed && (
        <div ref={trackRef} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scroll-smooth">
          {items.map((r) => (
            <div key={r.id} className="card snap-start shrink-0 p-4" style={{ width: "min(560px, 88vw)" }}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-slate-900">{r.title}</h4>
                  <div className="text-xs text-slate-400">Enregistré le {fmtDate(r.savedAt)}</div>
                </div>
                <button
                  onClick={() => onDelete(r.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  Supprimer
                </button>
              </div>
              <ReportArtifact agentKey={r.agentKey} agentLabel={r.agentLabel} report={r.report} chart={r.chart} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const byAgent = new Map<string, { label: string; items: SavedReport[] }>();
  for (const r of sorted) {
    if (!byAgent.has(r.agentKey)) byAgent.set(r.agentKey, { label: r.agentLabel, items: [] });
    byAgent.get(r.agentKey)!.items.push(r);
  }

  if (hydrated && reports.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucun rapport enregistré pour l&apos;instant. Depuis un agent, clique sur « Enregistrer le rapport » sous un
        rapport pour le retrouver ici.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...byAgent.entries()].map(([agentKey, group]) => (
        <AgentReportsRow key={agentKey} agentKey={agentKey} label={group.label} items={group.items} onDelete={del} />
      ))}
    </div>
  );
}
