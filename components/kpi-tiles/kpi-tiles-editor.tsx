"use client";

/**
 * Rendu + édition des tuiles KPI d'une page (même style que KpiStatTiles).
 * « Personnaliser » active le mode édition : retirer une tuile (par défaut ou
 * ajoutée), réafficher une tuile masquée, ajouter un KPI depuis les suggestions
 * du pôle (mêmes KPIs que l'étape KPI du formulaire d'alerte, filtrés par
 * outils connectés) ou un KPI personnalisé câblé par l'agent (tracking/preview).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StatTileVerdict } from "@/components/kpi-stat-tiles";

export type EditorTile = {
  key: string;
  kind: "default" | "added";
  /** Ligne page_tiles à supprimer pour retirer une tuile ajoutée. */
  rowId?: string;
  label: string;
  value: string;
  tone?: "pos" | "neg" | "accent" | "neutral";
  sub?: string;
  /** Couleur du sous-titre (évolution des tuiles ajoutées : ▲ vert / ▼ rouge). */
  subTone?: "pos" | "neg" | "neutral";
  verdict?: StatTileVerdict;
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

const UNIT_BADGE: Record<string, string> = { percent: "%", currency: "€", count: "#" };

const SUB_TONE: Record<NonNullable<EditorTile["subTone"]>, string> = {
  pos: "text-emerald-600 font-semibold",
  neg: "text-rose-600 font-semibold",
  neutral: "text-slate-400",
};

type CustomProposal = {
  forecast_type: string | null;
  agg_spec: Record<string, unknown> | null;
  label: string | null;
  current_value: number | null;
  unit_mode: string | null;
};

export function KpiTilesEditor({
  pageKey,
  team,
  tiles,
  hiddenDefaults,
  suggestions,
}: {
  pageKey: string;
  team: string;
  tiles: EditorTile[];
  hiddenDefaults: HiddenDefault[];
  suggestions: EditorSuggestion[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Catégories d'outils connectés à cette page (crm, billing, support…) — null = pas encore chargé.
  const [connectedCats, setConnectedCats] = useState<Set<string> | null>(null);

  // KPI personnalisé (texte libre → câblage agent via /api/tracking/preview)
  const [customText, setCustomText] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [proposal, setProposal] = useState<CustomProposal | null>(null);

  useEffect(() => {
    if (!panelOpen || connectedCats !== null) return;
    let alive = true;
    fetch(`/api/integrations/connected?page_key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => {
        if (!alive) return;
        const cats = new Set<string>((d.tools ?? []).map((t: { category: string }) => t.category));
        setConnectedCats(cats);
      })
      .catch(() => alive && setConnectedCats(new Set()));
    return () => { alive = false; };
  }, [panelOpen, connectedCats, pageKey]);

  const existingLabels = useMemo(() => new Set(tiles.map((t) => t.label)), [tiles]);
  const visibleSuggestions = useMemo(() => {
    let list = suggestions.filter((s) => !existingLabels.has(s.label));
    if (connectedCats && connectedCats.size > 0) {
      list = list.filter((s) => connectedCats.has(s.sourceCategory));
    }
    return list;
  }, [suggestions, existingLabels, connectedCats]);

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

  const removeRow = (rowId: string) =>
    mutate(`rm-${rowId}`, () => fetch(`/api/page-tiles/${rowId}`, { method: "DELETE" }));

  const addSuggestion = (s: EditorSuggestion) =>
    mutate(`add-${s.id}`, () =>
      fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: pageKey,
          kind: "kpi",
          title: s.label,
          forecast_type: s.forecastType ?? null,
          agg_spec: s.aggSpec ?? null,
          unit_mode: s.unit,
        }),
      }),
    );

  async function previewCustom() {
    if (customLoading || !customText.trim()) return;
    setCustomLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/tracking/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi_text: customText.trim(), team }),
      });
      const d = await res.json().catch(() => ({}));
      const r = d.resolution as CustomProposal | undefined;
      if (!res.ok || !r || (!r.forecast_type && !r.agg_spec)) {
        setError("Impossible de câbler ce KPI sur tes données — reformule-le ou choisis une suggestion.");
        return;
      }
      setProposal(r);
    } catch {
      setError("Une erreur est survenue pendant l'analyse.");
    } finally {
      setCustomLoading(false);
    }
  }

  const addCustom = () => {
    if (!proposal) return;
    return mutate("add-custom", () =>
      fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: pageKey,
          kind: "kpi",
          title: customText.trim() || proposal.label || "KPI personnalisé",
          forecast_type: proposal.forecast_type,
          agg_spec: proposal.agg_spec,
          unit_mode: proposal.unit_mode ?? "count",
        }),
      }),
    ).then(() => {
      setCustomText("");
      setProposal(null);
    });
  };

  const nothingToShow = tiles.length === 0 && hiddenDefaults.length === 0 && !editing;
  if (nothingToShow) {
    // Pas de tuile par défaut ni de perso : on garde uniquement le CTA discret.
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setEditing(true); setPanelOpen(true); }}
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
          onClick={() => { setEditing((e) => !e); if (editing) { setPanelOpen(false); setProposal(null); } }}
          className={`text-xs font-medium hover:underline ${editing ? "text-slate-500" : "text-accent"}`}
        >
          {editing ? "Terminer" : "Personnaliser les KPIs"}
        </button>
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.key} className="relative rounded-xl border border-slate-200 bg-white p-4">
              {editing && (
                <button
                  type="button"
                  title="Retirer cette tuile"
                  disabled={busy != null}
                  onClick={() => (t.kind === "added" && t.rowId ? removeRow(t.rowId) : hideTile(t.key))}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
                >
                  ✕
                </button>
              )}
              <p className="text-[11px] font-medium text-slate-500">{t.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${VALUE_TONE[t.tone ?? "neutral"]}`}>{t.value}</p>
              {t.sub && <p className={`mt-0.5 text-[10px] ${SUB_TONE[t.subTone ?? "neutral"]}`}>{t.sub}</p>}
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
              onClick={() => setPanelOpen((o) => !o)}
              className={`flex min-h-24 items-center justify-center rounded-xl border border-dashed p-4 text-sm font-medium transition ${
                panelOpen ? "border-accent bg-accent/5 text-accent" : "border-slate-300 text-slate-500 hover:border-accent hover:text-accent"
              }`}
            >
              ＋ Ajouter un KPI
            </button>
          )}
        </div>
      )}

      {editing && tiles.length === 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-500 transition hover:border-accent hover:text-accent"
        >
          ＋ Ajouter un KPI
        </button>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}

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

      {/* ── Panneau suggestions (même logique que l'étape KPI de l'alerte) ── */}
      {editing && panelOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Suggestions de la plateforme</p>
          <p className="mt-0.5 text-xs text-slate-500">
            KPIs adaptés à cette page, selon tes outils connectés. La valeur est recalculée en continu sur tes données.
          </p>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {visibleSuggestions.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">
                Toutes les suggestions de cette page sont déjà affichées, ou aucun outil compatible n&apos;est connecté.
              </p>
            )}
            {visibleSuggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy != null}
                onClick={() => addSuggestion(s)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{s.label}</span>
                  <span className="block text-xs text-slate-500">{s.description}</span>
                </span>
                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                  {UNIT_BADGE[s.unit]}
                </span>
              </button>
            ))}
          </div>

          {/* KPI personnalisé — câblé par l'agent, valeur prouvée avant ajout. */}
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3">
            <p className="text-xs font-semibold text-slate-700">✏️ KPI personnalisé</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => { setCustomText(e.target.value); setProposal(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") previewCustom(); }}
                placeholder="Ex : montant moyen des factures payées"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={customLoading || !customText.trim()}
                onClick={previewCustom}
                className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {customLoading ? "Analyse…" : "Analyser"}
              </button>
            </div>
            {proposal && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{proposal.label ?? customText}</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {proposal.current_value != null
                      ? `${proposal.current_value.toLocaleString("fr-FR")}${proposal.unit_mode === "percent" ? " %" : proposal.unit_mode === "currency" ? " €" : ""}`
                      : "Valeur indisponible pour le moment"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={addCustom}
                  className="shrink-0 rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/5 disabled:opacity-50"
                >
                  Ajouter cette tuile
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
