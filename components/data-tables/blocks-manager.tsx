"use client";

/**
 * « ＋ Ajouter un bloc » — liste UNIFIÉE de suggestions pour la page :
 *  - les blocs de la page retirés (page_tiles, kind=hide_block) : réaffichés en
 *    1 clic, en conservant leur visualisation d'origine (aperçu schématique) ;
 *  - les presets de la page (TABLE_PRESETS, filtrés par outils connectés) :
 *    créés comme page_data_tables, avec APERÇU RÉEL de la visualisation
 *    (recalcul déterministe /api/reports/recompute) avant l'ajout.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  filterPresetsBySources,
  presetsForPage,
  type SourceTool,
  type TablePreset,
} from "@/lib/reports/data-table-presets";

export type HiddenBlock = {
  rowId: string;
  label: string;
  /** Visualisation d'origine : carousel | funnel | chart-line | chart-bar | table | tiles. */
  view?: string;
  description?: string;
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

function fmtVal(v: number, unit: string): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toLocaleString("fr-FR")} %`;
  return v.toLocaleString("fr-FR");
}

/* ── Aperçu schématique (blocs de la page : la visualisation exacte revient au réaffichage) ── */
function SchematicPreview({ view }: { view?: string }) {
  const v = view ?? "table";
  if (v === "carousel") {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-16 flex-1 rounded-lg border border-slate-200 ${i === 1 ? "bg-slate-100" : "bg-slate-50"} p-2`}>
            <div className="h-2 w-2/3 rounded bg-slate-300" />
            <div className="mt-2 h-1.5 w-full rounded bg-slate-200" />
            <div className="mt-1 h-1.5 w-4/5 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }
  if (v === "funnel") {
    return (
      <div className="space-y-1">
        {[100, 72, 45, 22].map((w, i) => (
          <div key={i} className="h-3 rounded bg-slate-300/80" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (v === "chart-line" || v === "line") {
    return (
      <svg viewBox="0 0 240 60" className="h-16 w-full">
        <polyline points="0,50 40,42 80,45 120,30 160,24 200,14 240,8" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
      </svg>
    );
  }
  if (v === "chart-bar" || v === "bar") {
    return (
      <div className="flex h-16 items-end gap-1.5">
        {[35, 60, 45, 80, 55, 70, 40, 90].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-slate-300" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (v === "tiles") {
    return (
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
            <div className="h-1.5 w-2/3 rounded bg-slate-300" />
            <div className="mt-1.5 h-2 w-1/2 rounded bg-slate-400" />
          </div>
        ))}
      </div>
    );
  }
  // table / bloc / donut / défaut
  if (v === "donut") {
    return (
      <svg viewBox="0 0 60 60" className="mx-auto h-16 w-16">
        <circle cx="30" cy="30" r="22" fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle cx="30" cy="30" r="22" fill="none" stroke="#94a3b8" strokeWidth="9" strokeDasharray="80 58" transform="rotate(-90 30 30)" />
      </svg>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`flex justify-between px-2 py-1.5 ${i > 0 ? "border-t border-slate-100" : "bg-slate-50"}`}>
          <div className="h-2 w-1/3 rounded bg-slate-300" />
          <div className="h-2 w-10 rounded bg-slate-300" />
        </div>
      ))}
    </div>
  );
}

/* ── Aperçu RÉEL d'un preset (données recalculées) ── */
function DataPreview({ rows, view, unit }: { rows: PreviewRow[]; view: string; unit: string }) {
  const top = rows.slice(0, 8);
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1);

  if (view === "line") {
    const pts = rows.slice(0, 24);
    const mx = Math.max(...pts.map((r) => r.value), 1);
    const step = pts.length > 1 ? 240 / (pts.length - 1) : 240;
    const points = pts.map((r, i) => `${i * step},${58 - (r.value / mx) * 52}`).join(" ");
    return (
      <svg viewBox="0 0 240 60" className="h-20 w-full">
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2.5" />
      </svg>
    );
  }
  if (view === "donut") {
    const seg = rows.slice(0, 5);
    const total = seg.reduce((s, r) => s + Math.abs(r.value), 0) || 1;
    const C = 2 * Math.PI * 22;
    const palette = ["#6366f1", "#8b5cf6", "#0ea5e9", "#f59e0b", "#94a3b8"];
    // Segments précalculés (fraction + offset cumulé) — pas de mutation au rendu.
    const segments = seg.map((r, i) => ({
      name: r.name,
      color: palette[i],
      frac: Math.abs(r.value) / total,
      offset: seg.slice(0, i).reduce((s, x) => s + Math.abs(x.value) / total, 0),
    }));
    return (
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 60 60" className="h-20 w-20 shrink-0">
          {segments.map((s) => (
            <circle key={s.name} cx="30" cy="30" r="22" fill="none" stroke={s.color} strokeWidth="9"
              strokeDasharray={`${s.frac * C} ${C - s.frac * C}`} strokeDashoffset={-s.offset * C} transform="rotate(-90 30 30)" />
          ))}
        </svg>
        <ul className="min-w-0 flex-1 space-y-0.5 text-[10px] text-slate-500">
          {seg.map((r, i) => (
            <li key={r.name} className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette[i] }} />
              <span className="truncate">{r.name}</span>
              <span className="ml-auto font-semibold text-slate-700">{fmtVal(r.value, unit)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (view === "bar") {
    return (
      <div className="space-y-1">
        {top.map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-[10px]">
            <span className="w-24 shrink-0 truncate text-slate-500">{r.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-indigo-400" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-semibold text-slate-700">{fmtVal(r.value, unit)}</span>
          </div>
        ))}
      </div>
    );
  }
  // table / bloc
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 text-[11px]">
      {rows.slice(0, 6).map((r, i) => (
        <div key={r.name} className={`flex justify-between px-2.5 py-1 ${i > 0 ? "border-t border-slate-100" : "bg-slate-50 font-medium"}`}>
          <span className="truncate text-slate-600">{r.name}</span>
          <span className="ml-3 shrink-0 font-semibold tabular-nums text-slate-800">{fmtVal(r.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

export function BlocksManager({
  pageKey,
  tablesPageKey,
  hiddenBlocks,
}: {
  /** Clé page_tiles (masquages de blocs en dur) — réservée aux évolutions (les restaurations passent par rowId). */
  pageKey: string;
  /** Clé page_data_tables de la page (création des nouveaux blocs). */
  tablesPageKey: string;
  hiddenBlocks: HiddenBlock[];
}) {
  void pageKey;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<SourceTool[] | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  /** Entrée dépliée (aperçu visible) : `hidden-<rowId>` ou `preset-<id>`. */
  const [selected, setSelected] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});

  useEffect(() => {
    if (!open || tools !== null) return;
    let alive = true;
    fetch(`/api/integrations/connected?page_key=${encodeURIComponent(tablesPageKey)}`)
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => alive && setTools(Array.isArray(d.tools) ? d.tools : []))
      .catch(() => alive && setTools([]));
    return () => { alive = false; };
  }, [open, tools, tablesPageKey]);

  const presets = useMemo(
    () => filterPresetsBySources(presetsForPage(tablesPageKey), tools ?? []).filter((p) => !addedIds.has(p.id)),
    [tablesPageKey, tools, addedIds],
  );

  /** Aperçu réel d'un preset : recalcul déterministe (mêmes chiffres que le bloc créé). */
  function loadPresetPreview(p: TablePreset) {
    const key = `preset-${p.id}`;
    if (previews[key]?.rows || previews[key]?.loading) return;
    setPreviews((prev) => ({ ...prev, [key]: { loading: true, rows: null, error: null } }));
    fetch("/api/reports/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { entity: p.entity, groupBy: p.groupBy, measure: p.measure, field: p.field ?? undefined },
        sources: (tools ?? []).map((t) => t.key),
        all: true,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Aperçu indisponible");
        setPreviews((prev) => ({ ...prev, [key]: { loading: false, rows: Array.isArray(d.data) ? d.data : [], error: null } }));
      })
      .catch((e: Error) => {
        setPreviews((prev) => ({ ...prev, [key]: { loading: false, rows: null, error: e.message } }));
      });
  }

  async function restore(h: HiddenBlock) {
    if (busy) return;
    setBusy(`restore-${h.rowId}`);
    setError(null);
    try {
      const res = await fetch(`/api/page-tiles/${h.rowId}`, { method: "DELETE" });
      if (!res.ok) { setError("Impossible de réafficher ce bloc."); return; }
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
      setSelected(null);
      // La section « Tables de données » (composant client) recharge sa liste.
      window.dispatchEvent(new CustomEvent("revold:reload-page-tables"));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

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
          <p className="mt-0.5 text-xs text-slate-500">
            Clique sur un KPI pour voir un aperçu de sa visualisation avant de l&apos;ajouter.
            Les blocs de la page retirés gardent leur visualisation d&apos;origine.
          </p>

          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {/* ── Blocs de la page retirés — même visualisation au réaffichage ── */}
            {hiddenBlocks.map((h) => {
              const key = `hidden-${h.rowId}`;
              const isSelected = selected === key;
              return (
                <div key={key} className={`rounded-xl border transition ${isSelected ? "border-accent" : "border-slate-200"}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(isSelected ? null : key)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{h.label}</span>
                      <span className="block text-xs text-slate-500">
                        {h.description ?? "Bloc de la page — visualisation d'origine conservée"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                      {VIEW_LABELS[h.view ?? "table"] ?? "Bloc"}
                    </span>
                  </button>
                  {isSelected && (
                    <div className="border-t border-slate-100 p-3">
                      <SchematicPreview view={h.view} />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={busy != null}
                          onClick={() => restore(h)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === `restore-${h.rowId}` ? "Réaffichage…" : "Réafficher ce bloc"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Presets (nouveaux blocs) — aperçu réel avant ajout ── */}
            {tools === null && <p className="py-4 text-center text-xs text-slate-400">Chargement…</p>}
            {tools !== null && presets.length === 0 && hiddenBlocks.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">
                Aucune suggestion disponible — connecte un outil compatible ou crée un KPI personnalisé depuis « Tables de données ».
              </p>
            )}
            {presets.map((p) => {
              const key = `preset-${p.id}`;
              const isSelected = selected === key;
              const preview = previews[key];
              return (
                <div key={key} className={`rounded-xl border transition ${isSelected ? "border-accent" : "border-slate-200"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(isSelected ? null : key);
                      if (!isSelected) loadPresetPreview(p);
                    }}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
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
                  {isSelected && (
                    <div className="border-t border-slate-100 p-3">
                      {preview?.loading && <p className="py-3 text-center text-xs text-slate-400">Calcul de l&apos;aperçu…</p>}
                      {preview?.error && <p className="py-2 text-center text-xs text-rose-500">{preview.error}</p>}
                      {preview?.rows && preview.rows.length === 0 && (
                        <p className="py-3 text-center text-xs text-slate-400">Aucune donnée pour ce KPI pour le moment.</p>
                      )}
                      {preview?.rows && preview.rows.length > 0 && (
                        <DataPreview rows={preview.rows} view={p.view ?? "table"} unit={p.unit} />
                      )}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={busy != null}
                          onClick={() => addPreset(p)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === `add-${p.id}` ? "Ajout…" : "Ajouter ce bloc"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
