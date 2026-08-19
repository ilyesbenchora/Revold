"use client";

import { useState } from "react";

/**
 * Paramètres → Métriques : le DICTIONNAIRE des métriques de l'entreprise.
 * Chaque métrique = un nom (« CA signé ») + la définition MAISON (périmètre,
 * exclusions, pipeline de référence) + une unité optionnelle. Ces définitions
 * sont injectées dans TOUS les agents (chat, tableaux conversationnels,
 * câblage des KPIs personnalisés) : tout le monde parle du même chiffre.
 */

export type Metric = { id: string; label: string; definition: string; unit: string | null };

const UNIT_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "Unité libre" },
  { id: "currency", label: "€ (montant)" },
  { id: "percent", label: "% (taux)" },
  { id: "count", label: "Nombre" },
];

const field =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";

export function MetricDefinitionsForm({ initial, unavailable = false }: { initial: Metric[]; unavailable?: boolean }) {
  const [metrics, setMetrics] = useState<Metric[]>(initial);
  const [editing, setEditing] = useState<Metric | null>(null); // id "" = création
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing({ id: "", label: "", definition: "", unit: null });
    setError(null);
  }

  async function save() {
    if (!editing || busy) return;
    const label = editing.label.trim();
    const definition = editing.definition.trim();
    if (!label || !definition) {
      setError("Nom et définition sont obligatoires.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const isNew = editing.id === "";
      const res = await fetch("/api/metric-definitions", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? {} : { id: editing.id }),
          label,
          definition,
          unit: editing.unit || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.metric) {
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setMetrics((prev) => (isNew ? [...prev, d.metric] : prev.map((m) => (m.id === d.metric.id ? d.metric : m))));
      setEditing(null);
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/metric-definitions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setMetrics((prev) => prev.filter((m) => m.id !== id));
      else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Suppression impossible.");
      }
    } catch {
      setError("Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      {unavailable && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Migration 20260819000004_metric_definitions non appliquée — le dictionnaire s&apos;activera au prochain
          déploiement.
        </p>
      )}

      {metrics.length === 0 && !editing && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
          Aucune métrique définie. Ajoute les termes chiffrés de TON entreprise (« CA signé », « MRR net »,
          « churn »…) avec leur définition maison : chaque agent les appliquera au mot près.
        </p>
      )}

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {m.label}
                  {m.unit && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {UNIT_OPTIONS.find((u) => u.id === m.unit)?.label ?? m.unit}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.definition}</p>
              </div>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setEditing(m); setError(null); }}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(m.id)}
                  className="rounded-md px-2 py-1 text-[11px] text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Édition / création ── */}
      {editing && (
        <div className="mt-4 rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/30 p-4">
          <p className="text-xs font-semibold text-fuchsia-700">
            {editing.id === "" ? "Nouvelle métrique" : `Modifier « ${editing.label || "…" } »`}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom de la métrique</label>
              <input
                autoFocus
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="Ex : CA signé"
                className={field}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Unité</label>
              <select
                value={editing.unit ?? ""}
                onChange={(e) => setEditing({ ...editing, unit: e.target.value || null })}
                className={field}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Définition maison (périmètre, exclusions, pipeline de référence)
            </label>
            <textarea
              value={editing.definition}
              onChange={(e) => setEditing({ ...editing, definition: e.target.value })}
              rows={3}
              placeholder="Ex : montant des deals gagnés du pipeline « France », hors renouvellements et avenants."
              className={`${field} resize-none`}
            />
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="mt-4">
          <button
            type="button"
            onClick={startCreate}
            className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
          >
            ＋ Ajouter une métrique
          </button>
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Ces définitions sont injectées dans tous les agents Revold (chat, tableaux conversationnels, câblage des
        KPIs personnalisés) : quand tu emploies un de ces termes, l&apos;agent applique TA définition.
      </p>
    </div>
  );
}
