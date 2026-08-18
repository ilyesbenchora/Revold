"use client";

/**
 * Rendu + édition des tuiles KPI d'une page (même style que KpiStatTiles).
 * « Personnaliser » active le mode édition : retirer une tuile (par défaut ou
 * ajoutée), réafficher une tuile masquée ou un bloc retiré.
 *
 * L'AJOUT d'un KPI passe par le funnel unique des tables de données
 * (PageDataTables, événement `revold:open-data-table`) : sources à croiser →
 * KPI (suggestions filtrées ou personnalisé) → affichage. Le choix « Tuile
 * KPI » y crée un bloc classique sur cette première ligne ; un graphique ou
 * un tableau s'ajoute en dessous, dans « Tables de données ».
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StatTileVerdict } from "@/components/kpi-stat-tiles";
import type { TileDrill } from "@/lib/kpi/page-tiles";
import { DrilldownModal, type DrilldownTarget } from "@/components/reports/drilldown-modal";
import { SurgicalAlertButton, blockSourceKey, type SurgicalUnit } from "@/components/data-tables/surgical-alert-button";
import type { HiddenBlock } from "@/components/data-tables/blocks-manager";
import { setPageEditMode } from "@/components/data-tables/page-edit-mode";

export type EditorTile = {
  key: string;
  kind: "default" | "added";
  /** Ligne page_tiles à supprimer pour retirer une tuile ajoutée. */
  rowId?: string;
  label: string;
  value: string;
  /** Valeur numérique brute — rend la tuile alertable (cloche individuelle). */
  raw?: number | null;
  /** Unité de la valeur brute (percent | currency | count). */
  rawUnit?: SurgicalUnit;
  tone?: "pos" | "neg" | "accent" | "neutral";
  sub?: string;
  /** Couleur du sous-titre (évolution des tuiles ajoutées : ▲ vert / ▼ rouge). */
  subTone?: "pos" | "neg" | "neutral";
  /** Contexte de calcul (pipeline ciblé · période) — affiché en tout petit. */
  meta?: string;
  verdict?: StatTileVerdict;
  /** Drill-down : clic sur la tuile → détail des enregistrements (tuiles agg_spec). */
  drill?: TileDrill | null;
};

export type EditorSuggestion = {
  id: string;
  label: string;
  description: string;
  unit: "percent" | "currency" | "count";
  sourceCategory: string;
  forecastType?: string;
  aggSpec?: Record<string, unknown>;
};

export type HiddenDefault = { key: string; label: string; rowId: string };

const VALUE_TONE: Record<NonNullable<EditorTile["tone"]>, string> = {
  pos: "text-emerald-600",
  neg: "text-rose-600",
  accent: "text-indigo-600",
  neutral: "text-slate-900",
};

const VERDICT_TONE: Record<StatTileVerdict["tone"], string> = {
  pos: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  neg: "bg-rose-50 text-rose-700",
};

const SUB_TONE: Record<NonNullable<EditorTile["subTone"]>, string> = {
  pos: "text-emerald-600 font-semibold",
  neg: "text-rose-600 font-semibold",
  neutral: "text-slate-400",
};

export function KpiTilesEditor({
  pageKey,
  alertTeam = "revops",
  tiles,
  hiddenDefaults,
  hiddenBlocks = [],
}: {
  pageKey: string;
  /** Catalogue du pôle — conservé dans la signature (pages appelantes), l'ajout passe par le funnel. */
  team?: string;
  /** Équipe de l'alerte chirurgicale (sales | marketing | finance | csm | revops). */
  alertTeam?: string;
  tiles: EditorTile[];
  hiddenDefaults: HiddenDefault[];
  suggestions?: EditorSuggestion[];
  /** Clé page_data_tables — conservée pour compat, le funnel est global à la page. */
  tablesPageKey?: string;
  /** Blocs de la page retirés (réaffichables avec leur visualisation d'origine). */
  hiddenBlocks?: HiddenBlock[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Propage le mode édition à toute la page : les pastilles « ✕ Retirer »
  // des blocs (RemovableBlock) ne s'affichent que pendant la personnalisation.
  useEffect(() => {
    setPageEditMode(editing);
    return () => setPageEditMode(false);
  }, [editing]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Drill-down d'une tuile (hors mode édition) : détail des enregistrements.
  const [drillTarget, setDrillTarget] = useState<DrilldownTarget | null>(null);
  function openTileDrill(t: EditorTile) {
    if (!t.drill || editing) return;
    setDrillTarget({ ...t.drill, bucket: t.drill.bucket ?? null, title: t.label });
  }

  // ── Drag & drop des tuiles (mode édition) : réordonner en glissant, ordre
  // persisté côté serveur (page_tiles kind='tile_order') — optimiste. ──
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [orderedKeys, setOrderedKeys] = useState<string[] | null>(null);
  const displayTiles = useMemo(() => {
    if (!orderedKeys) return tiles;
    const idx = new Map(orderedKeys.map((k, i) => [k, i]));
    return [...tiles].sort(
      (a, b) => (idx.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (idx.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [tiles, orderedKeys]);

  function moveTile(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    const keys = displayTiles.map((t) => t.key);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(to, 0, ...keys.splice(from, 1));
    setOrderedKeys(keys);
    void fetch("/api/page-tiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_key: pageKey, kind: "tile_order", order: keys }),
    }).then(async (res) => {
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Réorganisation non enregistrée.");
      }
    });
  }

  /** Ouvre le funnel unique de création (PageDataTables sur la même page). */
  function openBuilder() {
    window.dispatchEvent(new CustomEvent("revold:open-data-table"));
  }

  async function mutate(key: string, fn: () => Promise<Response>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Une erreur est survenue.");
        return;
      }
      router.refresh();
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setBusy(null);
    }
  }

  const hideTile = (key: string) =>
    mutate(`hide-${key}`, () =>
      fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: pageKey, kind: "hide_tile", tile_key: key }),
      }),
    );

  // Réaffiche une tuile masquée OU un bloc retiré (suppression de la ligne
  // page_tiles de masquage — la visualisation d'origine revient telle quelle).
  const removeRow = (rowId: string) =>
    mutate(`rm-${rowId}`, () => fetch(`/api/page-tiles/${rowId}`, { method: "DELETE" }));

  const nothingToShow = tiles.length === 0 && hiddenDefaults.length === 0 && !editing;
  if (nothingToShow) {
    // Pas de tuile par défaut ni de perso : on garde uniquement le CTA discret.
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openBuilder}
          className="text-xs font-medium text-accent hover:underline"
        >
          ＋ Ajouter un KPI
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3">
        {editing && hiddenDefaults.length > 0 && (
          <span className="text-[11px] text-slate-400">
            {hiddenDefaults.length} tuile{hiddenDefaults.length > 1 ? "s" : ""} masquée{hiddenDefaults.length > 1 ? "s" : ""}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={`text-xs font-medium hover:underline ${editing ? "text-slate-500" : "text-accent"}`}
        >
          {editing ? "Terminer" : "Personnaliser les KPIs"}
        </button>
      </div>

      {editing && displayTiles.length > 1 && (
        <p className="text-right text-[11px] text-slate-400">⠿ Glisse les tuiles pour choisir leur ordre.</p>
      )}

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {displayTiles.map((t) => (
            <div
              key={t.key}
              draggable={editing}
              onDragStart={(e) => {
                setDragKey(t.key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (editing && dragKey && dragKey !== t.key) {
                  e.preventDefault();
                  setOverKey(t.key);
                }
              }}
              onDragLeave={() => setOverKey((k) => (k === t.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey) moveTile(dragKey, t.key);
                setDragKey(null);
                setOverKey(null);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setOverKey(null);
              }}
              onClick={() => openTileDrill(t)}
              title={!editing && t.drill ? "Voir le détail des enregistrements" : undefined}
              className={`group/tile relative rounded-xl border bg-white p-4 ${
                editing ? "cursor-grab active:cursor-grabbing" : t.drill ? "cursor-pointer transition hover:border-indigo-300 hover:shadow-sm" : ""
              } ${
                overKey === t.key && dragKey && dragKey !== t.key
                  ? "border-fuchsia-400 ring-2 ring-fuchsia-200"
                  : dragKey === t.key
                    ? "border-fuchsia-300 opacity-60"
                    : "border-slate-200"
              }`}
            >
              {editing ? (
                <button
                  type="button"
                  title="Retirer cette tuile"
                  disabled={busy != null}
                  onClick={() => (t.kind === "added" && t.rowId ? removeRow(t.rowId) : hideTile(t.key))}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
                >
                  ✕
                </button>
              ) : (
                // Alerte chirurgicale INDIVIDUELLE par tuile — cloche seule (tuile petite).
                typeof t.raw === "number" && !Number.isNaN(t.raw) && (
                  // stopPropagation : la cloche ne doit pas ouvrir le drill-down de la tuile.
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-1.5 top-1.5 opacity-0 transition group-hover/tile:opacity-100"
                  >
                    <SurgicalAlertButton
                      title={t.label}
                      scopeLabel={`la tuile KPI « ${t.label} »`}
                      impactScope={`le KPI ${t.label}`}
                      rows={[{ name: t.label, value: t.raw }]}
                      team={alertTeam}
                      unit={t.rawUnit ?? "count"}
                      allowTotal={false}
                      sourceKey={blockSourceKey(`kpi-${t.label}`, pageKey)}
                      iconOnly
                    />
                  </span>
                )
              )}
              <p className="text-[11px] font-medium text-slate-500">{t.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${VALUE_TONE[t.tone ?? "neutral"]}`}>{t.value}</p>
              {t.sub && <p className={`mt-0.5 text-[10px] ${SUB_TONE[t.subTone ?? "neutral"]}`}>{t.sub}</p>}
              {t.meta && <p className="mt-0.5 truncate text-[9px] text-slate-400" title={t.meta}>{t.meta}</p>}
              {t.verdict && (
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${VERDICT_TONE[t.verdict.tone]}`}>
                  {t.verdict.label}
                </span>
              )}
            </div>
          ))}
          {editing && (
            <button
              type="button"
              onClick={openBuilder}
              className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-500 transition hover:border-accent hover:text-accent"
            >
              ＋ Ajouter un KPI
            </button>
          )}
        </div>
      )}

      {editing && tiles.length === 0 && (
        <button
          type="button"
          onClick={openBuilder}
          className="w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-500 transition hover:border-accent hover:text-accent"
        >
          ＋ Ajouter un KPI
        </button>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* Modal de détail (drill-down d'une tuile) */}
      <DrilldownModal target={drillTarget} onClose={() => setDrillTarget(null)} />

      {/* ── Tuiles masquées : réafficher ── */}
      {editing && hiddenDefaults.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <span className="text-[11px] font-medium text-slate-500">Tuiles masquées :</span>
          {hiddenDefaults.map((h) => (
            <button
              key={h.key}
              type="button"
              disabled={busy != null}
              onClick={() => removeRow(h.rowId)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {h.label} · Réafficher
            </button>
          ))}
        </div>
      )}

      {/* ── Blocs de la page retirés : réafficher (visualisation d'origine) ── */}
      {editing && hiddenBlocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <span className="text-[11px] font-medium text-slate-500">Blocs retirés :</span>
          {hiddenBlocks.map((h) => (
            <button
              key={h.rowId}
              type="button"
              disabled={busy != null}
              title={h.description ?? "Ce bloc revient exactement tel qu'il était."}
              onClick={() => removeRow(h.rowId)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {h.label} · Réafficher
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
