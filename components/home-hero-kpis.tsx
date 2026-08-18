"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type HomeKpi = {
  id: string;
  label: string;
  /** Valeur déjà formatée côté serveur. */
  value: string;
  /** Sous-texte optionnel (ex : « Gérer → »). */
  hint?: string;
  href: string;
  /** Classe de couleur de la valeur (ex : text-fuchsia-600). */
  color: string;
  /** Ligne page_tiles kind='tile_override' (tuile renommée) — pour réinitialiser. */
  overrideRowId?: string;
  /** Libellé d'origine (avant renommage ✎). */
  originalLabel?: string;
};

/** Suggestion personnalisée du catalogue complet (« ＋ Plus de KPIs »). */
export type HomeKpiSuggestion = {
  id: string;
  label: string;
  description?: string;
  group: string;
};

const MAX_KPIS = 5;

const GROUP_LABELS: Record<string, string> = {
  sales: "Ventes",
  marketing: "Marketing",
  cs: "Service client",
  revops: "RevOps",
  ops: "Données",
  billing: "Facturation & trésorerie",
  support: "Support",
};

/**
 * Bloc héro de la home : KPIs essentiels PERSONNALISABLES — « Personnaliser »
 * permet de retirer des tuiles, de les renommer (✎) et d'en ajouter, soit depuis le catalogue
 * rapide (volumes réels), soit depuis la LISTE EXHAUSTIVE des suggestions par
 * pôle (« ＋ Plus de KPIs »), avec un plafond de 5 affichées. Sélection
 * persistée par organisation (page_tiles, page_key « home_hero »).
 */
export function HomeHeroKpis({
  kpis,
  initialSelected,
  suggestions = [],
}: {
  kpis: HomeKpi[];
  initialSelected: string[];
  suggestions?: HomeKpiSuggestion[];
}) {
  const router = useRouter();
  const byId = new Map(kpis.map((k) => [k.id, k]));
  const sugById = new Map(suggestions.map((s) => [s.id, s]));
  const [selected, setSelected] = useState<string[]>(
    initialSelected.filter((id) => byId.has(id) || sugById.has(id)).slice(0, MAX_KPIS),
  );
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── KPI « maison » : l'utilisateur ÉCRIT son KPI, l'agent le CÂBLE sur la
  // donnée réelle (même moteur que le funnel des tables), puis il rejoint les 5. ──
  const [kpiText, setKpiText] = useState("");
  const [wiring, setWiring] = useState(false);
  const [wireError, setWireError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    title: string;
    entity: string;
    group_by: string;
    measure: string;
    field: string | null;
    unit_mode: string | null;
    pipeline: string | null;
    target: string | null;
    rowCount?: number;
    agent?: string;
  } | null>(null);

  async function wireCustomKpi() {
    const text = kpiText.trim();
    if (!text || wiring) return;
    setWiring(true);
    setWireError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/page-tables/agent-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: "home_hero", custom_kpi: text, sources: [] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWireError(d.error ?? "Câblage impossible.");
        return;
      }
      setProposal(d.proposal);
    } catch {
      setWireError("Câblage impossible.");
    } finally {
      setWiring(false);
    }
  }

  async function addWiredKpi() {
    if (!proposal || full) return;
    setWireError(null);
    try {
      const res = await fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: "home_hero",
          kind: "kpi",
          title: proposal.title || kpiText.trim(),
          unit_mode: proposal.unit_mode ?? undefined,
          agg_spec: {
            entity: proposal.entity,
            groupBy: proposal.group_by,
            measure: proposal.measure,
            field: proposal.field ?? undefined,
            pipeline: proposal.pipeline ?? undefined,
            target: proposal.target ?? undefined,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.tile?.id) {
        setWireError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setProposal(null);
      setKpiText("");
      persist([...selected, `tile:${d.tile.id}`]);
    } catch {
      setWireError("Enregistrement impossible.");
    }
  }

  // Tuile affichée : valeur résolue côté serveur, ou placeholder « … » le temps
  // du refresh pour une suggestion tout juste ajoutée.
  const shown = selected
    .map(
      (id) =>
        byId.get(id) ??
        (sugById.has(id)
          ? { id, label: sugById.get(id)!.label, value: "…", href: "#", color: "text-indigo-600" }
          : id.startsWith("tile:")
            ? { id, label: "KPI personnalisé", value: "…", href: "#", color: "text-indigo-600" }
            : null),
    )
    .filter((k): k is HomeKpi => Boolean(k));
  const availableQuick = kpis.filter((k) => !selected.includes(k.id) && !k.id.startsWith("sug:"));
  const availableSuggestions = suggestions.filter((s) => !selected.includes(s.id));
  const full = selected.length >= MAX_KPIS;

  function persist(next: string[]) {
    setSelected(next);
    setError(null);
    void fetch("/api/page-tiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_key: "home_hero", kind: "tile_order", order: next }),
    }).then(async (res) => {
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
      } else {
        // Résout côté serveur la valeur des suggestions ajoutées.
        router.refresh();
      }
    });
  }

  const remove = (id: string) => persist(selected.filter((s) => s !== id));
  const add = (id: string) => !full && persist([...selected, id]);

  // ── Renommage d'une tuile (✎) : titre persisté en override (page_tiles
  // kind='tile_override', page_key home_hero) — la valeur reste calculée. ──
  const [rename, setRename] = useState<{ kpi: HomeKpi; title: string } | null>(null);
  const [renaming, setRenaming] = useState(false);

  async function saveRename() {
    if (!rename || renaming) return;
    const title = rename.title.trim();
    if (!title) return;
    const k = rename.kpi;
    // Titre revenu à l'origine → on supprime l'override plutôt que d'en garder un inutile.
    const isOriginal = title === (k.originalLabel ?? k.label);
    setRenaming(true);
    setError(null);
    try {
      const res = isOriginal
        ? k.overrideRowId
          ? await fetch(`/api/page-tiles/${k.overrideRowId}`, { method: "DELETE" })
          : null
        : await fetch("/api/page-tiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page_key: "home_hero", kind: "tile_override", tile_key: k.id, title }),
          });
      if (res && !res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setRename(null);
      router.refresh();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setRenaming(false);
    }
  }

  function resetRename() {
    if (!rename?.kpi.overrideRowId) return;
    const rowId = rename.kpi.overrideRowId;
    setRename(null);
    void fetch(`/api/page-tiles/${rowId}`, { method: "DELETE" }).then(() => router.refresh());
  }

  const groups = [...new Set(availableSuggestions.map((s) => s.group))];

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-end gap-2">
        {editing && (
          <span className="text-[11px] text-slate-400">
            {selected.length}/{MAX_KPIS} KPIs affichés
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e);
            setShowAll(false);
          }}
          className={`text-xs font-medium hover:underline ${editing ? "text-slate-500" : "text-accent"}`}
        >
          {editing ? "Terminer" : "Personnaliser"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
        {shown.map((k) =>
          editing ? (
            <div key={k.id} className="relative -m-2 rounded-lg border border-dashed border-slate-200 p-2">
              <button
                type="button"
                title="Retirer ce KPI"
                onClick={() => remove(k.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 transition hover:bg-rose-100 hover:text-rose-600"
              >
                ✕
              </button>
              {/* ✎ : renommer la tuile — la valeur reste calculée. */}
              <button
                type="button"
                title="Renommer ce KPI"
                onClick={() => setRename({ kpi: k, title: k.label })}
                className="absolute -top-1.5 right-4 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500 transition hover:bg-indigo-100 hover:text-indigo-600"
              >
                ✎
              </button>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              {k.hint && <p className="mt-1 text-[11px] text-slate-500">{k.hint}</p>}
            </div>
          ) : (
            <Link key={k.id} href={k.href} className="group block">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums transition group-hover:opacity-80 ${k.color}`}>{k.value}</p>
              {k.hint && <p className="mt-1 text-[11px] text-slate-500 group-hover:text-slate-700">{k.hint}</p>}
            </Link>
          ),
        )}
        {shown.length === 0 && (
          <p className="col-span-full text-center text-xs text-slate-400">
            Aucun KPI affiché — clique sur «&nbsp;Personnaliser&nbsp;» pour en ajouter.
          </p>
        )}
      </div>

      {/* Catalogue rapide : volumes réels + accès à la liste exhaustive */}
      {editing && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <span className="text-[11px] font-medium text-slate-500">Ajouter :</span>
            {availableQuick.map((k) => (
              <button
                key={k.id}
                type="button"
                disabled={full}
                title={full ? `Maximum ${MAX_KPIS} KPIs — retire-en un d'abord` : `Afficher « ${k.label} »`}
                onClick={() => add(k.id)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                ＋ {k.label} · {k.value}
              </button>
            ))}
            {availableSuggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  showAll
                    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                    : "border-fuchsia-200 bg-white text-fuchsia-600 hover:bg-fuchsia-50"
                }`}
              >
                ＋ Plus de KPIs ({availableSuggestions.length})
              </button>
            )}
            {full && (
              <span className="ml-auto text-[11px] text-amber-600">
                Maximum {MAX_KPIS} — retire un KPI pour en ajouter un autre.
              </span>
            )}
          </div>

          {/* Liste EXHAUSTIVE : UNE ligne par catégorie (pôles avec sources connectées uniquement) */}
          {showAll && (
            <div className="space-y-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50/30 p-3">
              <p className="text-[11px] text-slate-500">
                KPIs câblés sur ta donnée réelle — seuls les pôles dont les sources sont connectées sont proposés.
              </p>
              {groups.map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {GROUP_LABELS[g] ?? g}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
                    {availableSuggestions
                      .filter((s) => s.group === g)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={full}
                          title={full ? `Maximum ${MAX_KPIS} KPIs` : s.description ?? s.label}
                          onClick={() => add(s.id)}
                          className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ＋ {s.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}

              {/* ── Ton KPI « maison » : écris-le, l'agent le câble, il rejoint les 5 ── */}
              <div className="border-t border-fuchsia-100 pt-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">✨ Ton KPI :</span>
                  <input
                    value={kpiText}
                    onChange={(e) => setKpiText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") wireCustomKpi();
                    }}
                    placeholder="Ex : CA signé ce trimestre, factures impayées de plus de 30 jours…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
                  />
                  <button
                    type="button"
                    disabled={wiring || !kpiText.trim()}
                    onClick={wireCustomKpi}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {wiring ? "Câblage par l'agent…" : "Câbler ✨"}
                  </button>
                </div>
                {proposal && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[11px] text-emerald-800">
                      ✓ Câblé par {proposal.agent ?? "l'agent"} : <strong>{proposal.title || kpiText}</strong>
                      {typeof proposal.rowCount === "number" && <> · {proposal.rowCount.toLocaleString("fr-FR")} enregistrements analysés</>}
                    </span>
                    <button
                      type="button"
                      disabled={full}
                      onClick={addWiredKpi}
                      title={full ? `Maximum ${MAX_KPIS} KPIs — retire-en un d'abord` : undefined}
                      className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Ajouter aux {MAX_KPIS}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProposal(null)}
                      className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100"
                    >
                      Annuler
                    </button>
                  </div>
                )}
                {wireError && <p className="mt-1.5 text-[11px] text-rose-600">{wireError}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {/* ── Modal de renommage d'une tuile (✎) ── */}
      {rename && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !renaming && setRename(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">Renommer le KPI</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              La valeur reste calculée automatiquement — personnalise le titre affiché.
            </p>
            <label className="mt-4 block text-[11px] font-medium text-slate-500">
              Titre
              <input
                autoFocus
                value={rename.title}
                onChange={(e) => setRename({ ...rename, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-accent focus:outline-none"
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-2">
              {rename.kpi.overrideRowId ? (
                <button
                  type="button"
                  disabled={renaming}
                  onClick={resetRename}
                  title="Revenir au titre d'origine"
                  className="text-[11px] font-medium text-slate-400 transition hover:text-rose-600 hover:underline disabled:opacity-50"
                >
                  Réinitialiser
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={renaming}
                  onClick={() => setRename(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={renaming || !rename.title.trim()}
                  onClick={saveRename}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {renaming ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
