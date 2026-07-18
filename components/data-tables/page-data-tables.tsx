"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTableCard, type SavedTable } from "./data-table-card";
import {
  ENTITY_DIMS,
  presetsForPage,
  PAGE_AGENT_KEY,
  type TablePreset,
  type TableView,
} from "@/lib/reports/data-table-presets";
import { getAgentPersona, agentIsFeminine } from "@/lib/ai/agents/coach-personas";

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
  /** Vrai = KPI personnalisé construit par l'agent (entité/dimension décidées en back). */
  custom?: boolean;
  customKpi?: string;
};

export function PageDataTables({ pageKey }: { pageKey: string }) {
  const presets = presetsForPage(pageKey);
  const agentName = getAgentPersona(PAGE_AGENT_KEY[pageKey]).name;
  const agentPronoun = agentIsFeminine(PAGE_AGENT_KEY[pageKey]) ? "Elle" : "Il";
  const [tables, setTables] = useState<SavedTable[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customKpi, setCustomKpi] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/page-tables?page_key=${encodeURIComponent(pageKey)}`);
    if (res.ok) {
      const d = await res.json();
      setTables(Array.isArray(d.tables) ? d.tables : []);
    }
  }, [pageKey]);

  useEffect(() => { refresh(); }, [refresh]);

  function reset() { setStep(1); setDraft(null); setCustomKpi(""); setError(null); }

  // Les CTA « Créer une table de données » des blocs ouvrent ce builder.
  useEffect(() => {
    function onOpen() { reset(); setOpen(true); }
    window.addEventListener("revold:open-data-table", onOpen);
    return () => window.removeEventListener("revold:open-data-table", onOpen);
  }, []);

  function pickPreset(p: TablePreset) {
    setError(null);
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

  function startCustom() {
    if (!customKpi.trim()) return;
    setError(null);
    // Le titre reprend le KPI écrit ; l'agent choisit la donnée (entité/dimension)
    // en back-end à la création et peut peaufiner le libellé si besoin.
    const kpi = customKpi.trim();
    setDraft({ entity: "", group_by: "", measure: "count", field: null, unit_mode: null, view: "table", title: kpi, custom: true, customKpi: kpi });
    setStep(2);
  }

  async function create() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    const endpoint = draft.custom ? "/api/page-tables/agent-create" : "/api/page-tables";
    const payload = draft.custom
      ? { page_key: pageKey, custom_kpi: draft.customKpi, view: draft.view, title: draft.title || undefined }
      : { page_key: pageKey, ...draft };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && d.table) {
      setTables((t) => [...t, d.table]);
      setOpen(false);
      reset();
    } else {
      setError(d.error || "Création impossible.");
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
          onClick={() => { reset(); setOpen(true); }}
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
                <p className="mt-1 text-xs text-slate-500">Choisis un KPI proposé, ou décris le tien.</p>
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickPreset(p)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-accent hover:bg-indigo-50/40"
                    >
                      <span className="font-medium">{p.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  ))}
                  {presets.length === 0 && <p className="text-xs text-slate-400">Aucun KPI configuré pour cette page.</p>}
                </div>

                {/* KPI personnalisé — construit sur mesure par l'agent de la page. */}
                <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-indigo-50/30 p-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    KPI personnalisé
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">Décris précisément la donnée voulue — {agentName} construira la table sur mesure.</p>
                  <textarea
                    value={customKpi}
                    onChange={(e) => setCustomKpi(e.target.value)}
                    rows={2}
                    placeholder="Ex : montant moyen des deals gagnés par mois"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={startCustom}
                      disabled={!customKpi.trim()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Continuer →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && draft && (
              <div className="space-y-4">
                {draft.custom && (
                  <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-indigo-50/40 p-3 text-xs text-slate-600">
                    <span className="text-base leading-none">✨</span>
                    <span>
                      <span className="font-semibold text-accent">{agentName}</span> va construire la table à partir de :
                      <span className="mt-1 block italic text-slate-500">« {draft.customKpi} »</span>
                      {agentPronoun} choisit automatiquement la donnée la plus fiable et calculable.
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500">{draft.custom ? "Titre (repris de ton KPI)" : "Titre"}</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                {!draft.custom && (
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
                )}

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

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setStep(1); setError(null); }} className="text-xs text-slate-400 hover:text-accent">← Changer de KPI</button>
                  <button
                    onClick={create}
                    disabled={saving || (!draft.custom && !draft.title.trim())}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {draft.custom && !saving && <span aria-hidden>✨</span>}
                    {saving
                      ? draft.custom ? `${agentName} construit…` : "Création…"
                      : draft.custom ? `Créer via ${agentName}` : "Créer la table"}
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
