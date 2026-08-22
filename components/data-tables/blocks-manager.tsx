"use client";

/**
 * Liste de suggestions de blocs — intégrée au panneau « Personnaliser les
 * KPIs → Ajouter un KPI » (CTA unique, pas de bouton dédié) :
 *  - blocs de la page retirés (page_tiles, kind=hide_block) : réaffichés en
 *    1 clic, en conservant leur visualisation d'origine ;
 *  - presets de la page (TABLE_PRESETS, filtrés par outils connectés) : créés
 *    comme page_data_tables.
 * La sélection d'un bloc ouvre une FENÊTRE d'aperçu pleine qualité : données
 * réelles (recalcul déterministe /api/reports/recompute) rendues dans la
 * visualisation cible — mêmes standards visuels que les tables de données.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  filterPresetsBySources,
  presetsForPage,
  type SourceTool,
  type TablePreset,
} from "@/lib/reports/data-table-presets";

/** Spec d'aperçu RÉEL d'un bloc de la page (option « Revold »). */
export type HiddenBlockPreviewSpec = {
  entity: string;
  groupBy: string;
  measure: string;
  field?: string | null;
  unit: "currency" | "count" | "percent";
  view: "bar" | "line" | "donut" | "table";
};

export type HiddenBlock = {
  rowId: string;
  label: string;
  /** Visualisation d'origine : carousel | funnel | chart-line | chart-bar | table | tiles. */
  view?: string;
  description?: string;
  /** Présent → la fenêtre montre un APERÇU RÉEL (données recalculées), sinon schématique. */
  preview?: HiddenBlockPreviewSpec;
};

type PreviewRow = { name: string; value: number };
type PreviewState = { loading: boolean; rows: PreviewRow[] | null; error: string | null };

const VIEW_LABELS: Record<string, string> = {
  carousel: "Carrousel par pipeline",
  funnel: "Funnel de conversion",
  "chart-line": "Courbe",
  "chart-bar": "Barres",
  table: "Table",
  tiles: "Tuiles",
  bar: "Barres",
  line: "Courbe",
  donut: "Donut",
  bloc: "Bloc",
};

const PALETTE = ["#6366f1", "#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#64748b", "#a855f7"];

export function fmtVal(v: number, unit: string): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toLocaleString("fr-FR")} %`;
  return v.toLocaleString("fr-FR");
}

/* ── Aperçu schématique grand format (blocs de la page : la visualisation
      exacte — carrousel, funnel… — revient telle quelle au réaffichage) ── */
function SchematicPreview({ view }: { view?: string }) {
  const v = view ?? "table";
  if (v === "carousel") {
    return (
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-32 flex-1 rounded-xl border p-3 ${i === 1 ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-slate-50"}`}>
            <div className="h-2.5 w-2/3 rounded bg-indigo-300" />
            <div className="mt-3 space-y-1.5">
              {[100, 75, 50].map((w, j) => (
                <div key={j} className="h-2 rounded bg-indigo-200" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="mt-3 h-2 w-1/2 rounded bg-slate-300" />
          </div>
        ))}
      </div>
    );
  }
  if (v === "funnel") {
    return (
      <div className="space-y-2">
        {[100, 72, 45, 22].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-6 rounded-lg" style={{ width: `${w}%`, background: PALETTE[i] }} />
            <span className="text-[11px] font-semibold text-slate-500">{w} %</span>
          </div>
        ))}
      </div>
    );
  }
  if (v === "chart-line" || v === "line") {
    return (
      <svg viewBox="0 0 480 140" className="w-full">
        <polyline points="0,120 60,100 120,108 180,72 240,60 300,36 360,42 420,20 480,12" fill="none" stroke="#6366f1" strokeWidth="3" />
        <polyline points="0,120 60,100 120,108 180,72 240,60 300,36 360,42 420,20 480,12 480,140 0,140" fill="#6366f1" opacity="0.08" />
      </svg>
    );
  }
  if (v === "chart-bar" || v === "bar") {
    return (
      <div className="flex h-36 items-end gap-2">
        {[35, 60, 45, 80, 55, 70, 40, 90, 65, 50].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: PALETTE[i % PALETTE.length] }} />
        ))}
      </div>
    );
  }
  if (v === "tiles") {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-2 w-2/3 rounded bg-slate-300" />
            <div className="mt-2.5 h-3.5 w-1/2 rounded bg-indigo-300" />
          </div>
        ))}
      </div>
    );
  }
  if (v === "donut") {
    return (
      <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36">
        <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="18" />
        <circle cx="60" cy="60" r="44" fill="none" stroke="#6366f1" strokeWidth="18" strokeDasharray="160 116" transform="rotate(-90 60 60)" />
        <circle cx="60" cy="60" r="44" fill="none" stroke="#8b5cf6" strokeWidth="18" strokeDasharray="70 206" strokeDashoffset="-160" transform="rotate(-90 60 60)" />
      </svg>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`flex justify-between px-4 py-2.5 ${i > 0 ? "border-t border-slate-100" : "bg-slate-50"}`}>
          <div className="h-2.5 w-1/3 rounded bg-slate-300" />
          <div className="h-2.5 w-16 rounded bg-indigo-200" />
        </div>
      ))}
    </div>
  );
}

/* ── Aperçu RÉEL grand format d'un preset (données recalculées) — aussi
      utilisé par l'aperçu optionnel du funnel de création (PageDataTables). ── */
export function DataPreview({ rows, view, unit }: { rows: { name: string; value: number }[]; view: string; unit: string }) {
  const top = rows.slice(0, 10);
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1);

  if (view === "line") {
    const pts = rows.slice(0, 36);
    const mx = Math.max(...pts.map((r) => r.value), 1);
    const step = pts.length > 1 ? 480 / (pts.length - 1) : 480;
    const points = pts.map((r, i) => `${i * step},${132 - (r.value / mx) * 120}`).join(" ");
    return (
      <div>
        <svg viewBox="0 0 480 140" className="w-full">
          <polyline points={`${points} 480,140 0,140`} fill="#6366f1" opacity="0.08" />
          <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="3" />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{pts[0]?.name}</span>
          <span>{pts[pts.length - 1]?.name}</span>
        </div>
      </div>
    );
  }
  if (view === "donut") {
    const seg = rows.slice(0, 6);
    const total = seg.reduce((s, r) => s + Math.abs(r.value), 0) || 1;
    const C = 2 * Math.PI * 44;
    const segments = seg.map((r, i) => ({
      name: r.name,
      value: r.value,
      color: PALETTE[i % PALETTE.length],
      frac: Math.abs(r.value) / total,
      offset: seg.slice(0, i).reduce((s, x) => s + Math.abs(x.value) / total, 0),
    }));
    return (
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0">
          {segments.map((s) => (
            <circle key={s.name} cx="60" cy="60" r="44" fill="none" stroke={s.color} strokeWidth="18"
              strokeDasharray={`${s.frac * C} ${C - s.frac * C}`} strokeDashoffset={-s.offset * C} transform="rotate(-90 60 60)" />
          ))}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs text-slate-600">
          {segments.map((s) => (
            <li key={s.name} className="flex items-center gap-2 truncate">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto font-semibold text-slate-800">{fmtVal(s.value, unit)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (view === "bar") {
    return (
      <div className="space-y-2">
        {top.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0 truncate text-slate-500">{r.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-md bg-slate-100">
              <div className="h-full rounded-md" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
            <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-800">{fmtVal(r.value, unit)}</span>
          </div>
        ))}
      </div>
    );
  }
  // table / bloc
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 text-sm">
      {rows.slice(0, 8).map((r, i) => (
        <div key={r.name} className={`flex justify-between px-4 py-2 ${i > 0 ? "border-t border-slate-100" : "bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-400"}`}>
          <span className="truncate text-slate-600">{r.name}</span>
          <span className="ml-3 shrink-0 font-semibold tabular-nums text-slate-800">{fmtVal(r.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compat : CTA autonome « ＋ Ajouter un bloc » — encore utilisé par la page
 * Audit données (refonte en cours). Les autres pages passent par le panneau
 * « Personnaliser les KPIs » (BlockSuggestionList intégrée, CTA unique).
 */
export function BlocksManager({
  pageKey,
  tablesPageKey,
  hiddenBlocks,
}: {
  pageKey: string;
  tablesPageKey: string;
  hiddenBlocks: HiddenBlock[];
}) {
  void pageKey;
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`text-xs font-medium hover:underline ${open ? "text-slate-500" : "text-accent"}`}
        >
          {open ? "Fermer" : "＋ Ajouter un bloc"}
        </button>
      </div>
      {open && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Suggestions de blocs</p>
          <BlockSuggestionList tablesPageKey={tablesPageKey} hiddenBlocks={hiddenBlocks} />
        </div>
      )}
    </div>
  );
}

/**
 * Liste des suggestions de blocs — la sélection ouvre la fenêtre d'aperçu.
 */
export function BlockSuggestionList({
  tablesPageKey,
  hiddenBlocks,
}: {
  /** Clé page_data_tables de la page (création des nouveaux blocs). */
  tablesPageKey: string;
  hiddenBlocks: HiddenBlock[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<SourceTool[] | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  /** Bloc sélectionné → fenêtre d'aperçu ouverte. */
  const [selectedHidden, setSelectedHidden] = useState<HiddenBlock | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<TablePreset | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ loading: false, rows: null, error: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (tools !== null) return;
    let alive = true;
    fetch(`/api/integrations/connected?page_key=${encodeURIComponent(tablesPageKey)}`)
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => alive && setTools(Array.isArray(d.tools) ? d.tools : []))
      .catch(() => alive && setTools([]));
    return () => { alive = false; };
  }, [tools, tablesPageKey]);

  const presets = useMemo(
    () => filterPresetsBySources(presetsForPage(tablesPageKey), tools ?? []).filter((p) => !addedIds.has(p.id)),
    [tablesPageKey, tools, addedIds],
  );

  /** Recalcul déterministe partagé (preset OU aperçu réel d'un bloc de page). */
  function loadRealPreview(query: { entity: string; groupBy: string; measure: string; field?: string | null }) {
    setPreview({ loading: true, rows: null, error: null });
    fetch("/api/reports/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { entity: query.entity, groupBy: query.groupBy, measure: query.measure, field: query.field ?? undefined },
        sources: (tools ?? []).map((t) => t.key),
        all: true,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Aperçu indisponible");
        setPreview({ loading: false, rows: Array.isArray(d.data) ? d.data : [], error: null });
      })
      .catch((e: Error) => setPreview({ loading: false, rows: null, error: e.message }));
  }

  function openPresetPreview(p: TablePreset) {
    setSelectedHidden(null);
    setSelectedPreset(p);
    loadRealPreview({ entity: p.entity, groupBy: p.groupBy, measure: p.measure, field: p.field });
  }

  /** Ouvre l'aperçu d'un bloc de page : réel si le bloc porte une spec, sinon schématique. */
  function openHiddenPreview(h: HiddenBlock) {
    setSelectedPreset(null);
    setSelectedHidden(h);
    if (h.preview) loadRealPreview(h.preview);
    else setPreview({ loading: false, rows: null, error: null });
  }

  function closeModal() {
    setSelectedHidden(null);
    setSelectedPreset(null);
    setPreview({ loading: false, rows: null, error: null });
  }

  async function restore(h: HiddenBlock) {
    if (busy) return;
    setBusy(`restore-${h.rowId}`);
    setError(null);
    try {
      const res = await fetch(`/api/page-tiles/${h.rowId}`, { method: "DELETE" });
      if (!res.ok) { setError("Impossible de réafficher ce bloc."); return; }
      closeModal();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addPreset(p: TablePreset) {
    if (busy) return;
    setBusy(`add-${p.id}`);
    setError(null);
    try {
      const res = await fetch("/api/page-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: tablesPageKey,
          title: p.label,
          entity: p.entity,
          group_by: p.groupBy,
          measure: p.measure,
          field: p.field ?? null,
          unit_mode: p.unit,
          view: p.view ?? "table",
          sources: (tools ?? []).map((t) => t.key),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Impossible de créer ce bloc.");
        return;
      }
      setAddedIds((prev) => new Set(prev).add(p.id));
      closeModal();
      // La section « Tables de données » (composant client) recharge sa liste.
      window.dispatchEvent(new CustomEvent("revold:reload-page-tables"));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const modalOpen = selectedHidden !== null || selectedPreset !== null;

  return (
    <div className="space-y-2">
      <p className="mt-0.5 text-xs text-slate-500">
        Clique sur un bloc pour ouvrir l&apos;aperçu de sa visualisation avant de l&apos;ajouter.
        Les blocs de la page retirés gardent leur visualisation d&apos;origine.
      </p>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {/* ── Blocs de la page retirés ── */}
        {hiddenBlocks.map((h) => (
          <button
            key={h.rowId}
            type="button"
            onClick={() => openHiddenPreview(h)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-accent/5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{h.label}</span>
              <span className="block truncate text-xs text-slate-500">
                {h.description ?? "Bloc de la page — visualisation d'origine conservée"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {/* Badge « Revold » : bloc natif de la plateforme, aperçu réel. */}
              <span className="rounded-md bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-600">
                Revold
              </span>
              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                {VIEW_LABELS[h.view ?? "table"] ?? "Bloc"}
              </span>
            </span>
          </button>
        ))}

        {/* ── Presets (nouveaux blocs) ── */}
        {tools === null && <p className="py-4 text-center text-xs text-slate-400">Chargement…</p>}
        {tools !== null && presets.length === 0 && hiddenBlocks.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">
            Aucune suggestion disponible — connecte un outil compatible ou crée un KPI personnalisé depuis « Tables de données ».
          </p>
        )}
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openPresetPreview(p)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-accent/5"
          >
            <span className="text-sm font-medium text-slate-800">{p.label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {VIEW_LABELS[p.view ?? "table"]}
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                {p.unit === "currency" ? "€" : p.unit === "percent" ? "%" : "#"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* ── Fenêtre d'aperçu pleine qualité ── */}
      {mounted && modalOpen && createPortal(
        <div className="dashboard-shell fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4" onClick={closeModal}>
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedHidden?.label ?? selectedPreset?.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedHidden
                    ? selectedHidden.preview
                      ? `Aperçu Revold sur tes données réelles — le bloc revient avec sa visualisation d'origine`
                      : selectedHidden.description ?? "Bloc de la page — il revient exactement tel qu'il était."
                    : `Aperçu sur tes données réelles · ${VIEW_LABELS[selectedPreset?.view ?? "table"]}`}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                {VIEW_LABELS[(selectedHidden ? selectedHidden.view : selectedPreset?.view) ?? "table"] ?? "Bloc"}
              </span>
            </div>

            <div className="mt-4 min-h-36">
              {/* Bloc de page SANS spec d'aperçu réel → schématique (visualisation dédiée). */}
              {selectedHidden && !selectedHidden.preview && <SchematicPreview view={selectedHidden.view} />}
              {/* Preset OU bloc de page AVEC spec → aperçu réel (recalcul déterministe). */}
              {(selectedPreset || selectedHidden?.preview) && (
                <>
                  {preview.loading && (
                    <p className="py-10 text-center text-xs text-slate-400">Calcul de l&apos;aperçu sur tes données…</p>
                  )}
                  {preview.error && <p className="py-8 text-center text-xs text-rose-500">{preview.error}</p>}
                  {preview.rows && preview.rows.length === 0 && (
                    <p className="py-10 text-center text-xs text-slate-400">Aucune donnée pour ce KPI pour le moment.</p>
                  )}
                  {preview.rows && preview.rows.length > 0 && (
                    <DataPreview
                      rows={preview.rows}
                      view={(selectedHidden?.preview?.view ?? selectedPreset?.view) ?? "table"}
                      unit={(selectedHidden?.preview?.unit ?? selectedPreset?.unit) ?? "count"}
                    />
                  )}
                </>
              )}
            </div>

            {selectedHidden && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                {selectedHidden.preview
                  ? "Aperçu Revold sur tes données réelles. Au réaffichage, le bloc revient avec sa visualisation d'origine complète (carrousel, funnel, cartes…), plus riche que cet aperçu."
                  : "Aperçu schématique : ce bloc utilise une visualisation dédiée de la page (carrousel, funnel…) — il se réaffiche exactement comme avant son retrait."}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={closeModal} className="text-xs text-slate-400 hover:text-slate-600">
                Annuler
              </button>
              {selectedHidden && (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => restore(selectedHidden)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Réaffichage…" : "Réafficher ce bloc"}
                </button>
              )}
              {selectedPreset && (
                <button
                  type="button"
                  disabled={busy != null || preview.loading}
                  onClick={() => addPreset(selectedPreset)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Ajout…" : "Ajouter ce bloc"}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
