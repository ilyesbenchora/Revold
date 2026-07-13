"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { SAVED_REPORTS_KEY, listSavedReports, removeSavedReport, type SavedReport } from "./saved-reports";

type Alert = {
  id: string;
  title: string;
  description: string;
  impact: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
};

function fmtDate(ts: number | string | null): string {
  if (ts == null) return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function MesRapports({ alerts }: { alerts: Alert[] }) {
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

  return (
    <div className="space-y-8">
      {/* Rapports enregistrés (avec visualisations) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Rapports enregistrés{reports.length > 0 ? ` (${reports.length})` : ""}
        </h2>
        {hydrated && reports.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucun rapport enregistré pour l&apos;instant. Depuis un agent, active la suggestion d&apos;alerte sous un
            rapport pour l&apos;enregistrer ici.
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-fuchsia-600">{r.agentLabel}</div>
                    <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                    <div className="text-xs text-slate-400">Enregistré le {fmtDate(r.savedAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/agents/${r.agentKey}`}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Ouvrir l&apos;agent
                    </Link>
                    <button
                      onClick={() => del(r.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {r.report && <AgentReport spec={r.report} />}
                {r.chart && <ChartPicker proposal={r.chart} />}

                <div className="mt-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
                    Alerte activée
                  </div>
                  <div className="text-sm font-medium text-slate-800">{r.alert.title}</div>
                  <p className="mt-0.5 text-xs text-slate-600">{r.alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Alertes activées (Supabase) — inclut celles créées sans rapport enregistré */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Alertes activées{alerts.length > 0 ? ` (${alerts.length})` : ""}
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucune alerte active.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-fuchsia-700">
                    {a.category ?? "revops"}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{a.title}</h3>
                <p className="mt-0.5 text-xs text-slate-600">{a.description}</p>
                {a.impact && <p className="mt-1 text-[11px] text-slate-500">Impact : {a.impact}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
