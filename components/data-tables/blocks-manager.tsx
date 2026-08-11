"use client";

/**
 * « ＋ Ajouter un bloc » — suggestions de blocs pour la page :
 *  - réafficher les blocs en dur masqués (page_tiles, kind=hide_block) ;
 *  - créer un bloc depuis les presets de la page (TABLE_PRESETS, filtrés par
 *    outils connectés — même funnel que « Tables de données », en un clic).
 * Les blocs créés sont des page_data_tables : ils apparaissent dans la section
 * « Tables de données » de la page et restent éditables là-bas.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  filterPresetsBySources,
  presetsForPage,
  type SourceTool,
  type TablePreset,
} from "@/lib/reports/data-table-presets";

export type HiddenBlock = { rowId: string; label: string };

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
          {hiddenBlocks.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-700">Blocs masqués</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hiddenBlocks.map((h) => (
                  <button
                    key={h.rowId}
                    type="button"
                    disabled={busy != null}
                    onClick={() => restore(h)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {h.label} · Réafficher
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm font-semibold text-slate-900">Suggestions de blocs</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Blocs adaptés à cette page selon tes outils connectés. Ils apparaissent dans « Tables de données », où tu peux les modifier ou les supprimer.
          </p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {tools === null && <p className="py-4 text-center text-xs text-slate-400">Chargement…</p>}
            {tools !== null && presets.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">
                Aucune suggestion disponible — connecte un outil compatible ou crée un KPI personnalisé depuis « Tables de données ».
              </p>
            )}
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy != null}
                onClick={() => addPreset(p)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-slate-800">{p.label}</span>
                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                  {p.unit === "currency" ? "€" : p.unit === "percent" ? "%" : "#"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
