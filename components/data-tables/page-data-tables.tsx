"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTableCard, type SavedTable } from "./data-table-card";
import {
  ENTITY_DIMS,
  presetsForPage,
  type TablePreset,
  type TableView,
} from "@/lib/reports/data-table-presets";

const VIEWS: { id: TableView; label: string; icon: string }[] = [
  { id: "table", label: "Tableau", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" },
  { id: "bar", label: "Barres", icon: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
  { id: "line", label: "Courbe", icon: "M3 3v18h18M6 14l4-4 3 3 5-6" },
  { id: "donut", label: "Anneau", icon: "M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6" },
];

type Draft = {
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: TableView;
  title: string;
};

export function PageDataTables({ pageKey }: { pageKey: string }) {
  const presets = presetsForPage(pageKey);
  const [tables, setTables] = useState<SavedTable[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/page-tables?page_key=${encodeURIComponent(pageKey)}`);
    if (res.ok) {
      const d = await res.json();
      setTables(Array.isArray(d.tables) ? d.tables : []);
    }
  }, [pageKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // Les CTA « Créer une table de données » des blocs ouvrent ce builder.
  useEffect(() => {
    function onOpen() { setStep(1); setDraft(null); setOpen(true); }
    window.addEventListener("revold:open-data-table", onOpen);
    return () => window.removeEventListener("revold:open-data-table", onOpen);
  }, []);

  function pickPreset(p: TablePreset) {
    setDraft({
      entity: p.entity,
      group_by: p.groupBy,
      measure: p.measure,
      field: p.field ?? null,
      unit_mode: p.unit,
      view: p.view ?? "table",
      title: p.label,
    });
    setStep(2);
  }

  async function create() {
    if (!draft || saving) return;
    setSaving(true);
    const res = await fetch("/api/page-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_key: pageKey, ...draft }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      if (d.table) setTables((t) => [...t, d.table]);
      setOpen(false);
      setStep(1);
      setDraft(null);
    }
  }

  const dims = draft ? ENTITY_DIMS[draft.entity] ?? [] : [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Tables de données
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Construisez vos visualisations à partir de vos données réelles.</p>
        </div>
        <button
          onClick={() => { setStep(1); setDraft(null); setOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Créer une table de données
        </button>
      </div>

      {tables.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">Aucune table de données pour l&apos;instant.</p>
          <p className="text-xs text-slate-400">Cliquez sur « Créer une table de données » pour visualiser un KPI de cette page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tables.map((t) => (
            <DataTableCard key={t.id} table={t} onDeleted={(id) => setTables((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}

      {/* Builder */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
              <span className={step === 1 ? "font-semibold text-accent" : ""}>1. KPI</span>
              <span>→</span>
              <span className={step === 2 ? "font-semibold text-accent" : ""}>2. Affichage</span>
            </div>

            {step === 1 && (
              <div>
                <h3 className="text-base font-semibold text-slate-900">Quelle donnée visualiser ?</h3>
                <p className="mt-1 text-xs text-slate-500">KPIs disponibles pour cette page.</p>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickPreset(p)}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-accent hover:bg-indigo-50/40"
                    >
                      <span className="font-medium">{p.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  ))}
                  {presets.length === 0 && <p className="text-xs text-slate-400">Aucun KPI configuré pour cette page.</p>}
                </div>
              </div>
            )}

            {step === 2 && draft && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500">Titre</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Grouper par</label>
                  <select
                    value={draft.group_by}
                    onChange={(e) => setDraft({ ...draft, group_by: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                  >
                    {dims.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Affichage</label>
                  <div className="mt-1 grid grid-cols-4 gap-2">
                    {VIEWS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDraft({ ...draft, view: v.id })}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] transition ${
                          draft.view === v.id ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={v.icon} /></svg>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-accent">← Changer de KPI</button>
                  <button
                    onClick={create}
                    disabled={saving || !draft.title.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving ? "Création…" : "Créer la table"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
